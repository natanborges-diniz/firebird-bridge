// src/services/recebimentosService.js
//
// Fase 1 — Dados de recebimento (docs/REVISAO_VENDAS_METAS.md §5.1).
// Base de metas e comissoes sobre VALORES RECEBIDOS (regime de caixa):
//   * detalhe de parcelas pagas (recebimentos_detalhe.sql);
//   * agregado por (empresa, vendedor, data_pagamento, forma_categoria,
//     origem) — shape consumido pelo sync diario (recebimentos_agregado_diario
//     no Supabase);
//   * modo alternativo "emitido em OS" (emitidos_por_vendedor.sql);
//   * devolucoes com restituicao (devolucoes_restituicao.sql — hipotese
//     PENDENTE VALIDACAO, com fallback gracioso se o schema nao tiver as
//     tabelas/colunas esperadas).
//
// Mesmo padrao do vendasService: fan-out por empresa (Promise.allSettled +
// coletarResultadosFanout, D13), filtro de venda regular injetado em runtime
// (garantia nao e venda) e cache com TTL CURTO — recebimentos do dia mudam ao
// longo do dia.
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { parseEmpresasParam } = require("../utils/empresaHelper");
const { hasColumn, hasTable } = require("../utils/schemaIntrospection");
const { aplicarFiltroVendaRegular } = require("../utils/vendaRegular");
const { coletarResultadosFanout } = require("../utils/fanout");
const { getCachedOrFetch } = require("../utils/queryCache");

const LOG_QUERY_TIME = process.env.LOG_QUERY_TIME === "true";
// TTL curto (default 60s): dados do dia corrente mudam a cada pagamento.
const RECEBIMENTOS_TTL_MS = Number(process.env.RECEBIMENTOS_CACHE_TTL_MS || 60 * 1000);

function loadSql(filename) {
  const filePath = path.join(__dirname, "..", "..", "queries", "vendas", filename);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`[RECEBIMENTOS] SQL FILE NOT FOUND: ${filePath}`);
    throw err;
  }
}

const SQL_RECEBIMENTOS_DETALHE = loadSql("recebimentos_detalhe.sql");
const SQL_EMITIDOS_POR_VENDEDOR = loadSql("emitidos_por_vendedor.sql");
const SQL_DEVOLUCOES_RESTITUICAO = loadSql("devolucoes_restituicao.sql");

// Dependencias de schema da hipotese de devolucao com restituicao
// (PENDENTE VALIDACAO — npm run validar:recebimentos). Se ausentes,
// getDevolucoesRestituicao retorna vazio sem quebrar.
const DEVOLUCAO_TABLE = "ENTRADANOTAFISCALDEVOLUCAO";
const DEVOLUCAO_VENDEDOR_COLUMN = "COD_VENDEDOR";

function normalizarDataISO(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return value ?? null;
}

// --------- QUERIES POR EMPRESA ---------
async function getRecebimentosDetalhePorEmpresa(codEmpresa, dataInicio, dataFim, options = {}) {
  // ordem dos parametros = ordem dos "?" no SQL:
  // origem (dataIni), datapagamento ini/fim, empresa, empresa (regra 13/18)
  const params = [dataInicio, dataInicio, dataFim, codEmpresa, codEmpresa];
  return getCachedOrFetch({
    label: "recebimentos.detalhe",
    params,
    ttlMs: options.cacheTtlMs ?? RECEBIMENTOS_TTL_MS,
    enabled: options.useCache !== false,
    fetcher: async () =>
      db.runQuery(await aplicarFiltroVendaRegular(SQL_RECEBIMENTOS_DETALHE, "t"), params),
  });
}

async function getEmitidosPorEmpresa(codEmpresa, dataInicio, dataFim, options = {}) {
  const params = [dataInicio, dataFim, codEmpresa, codEmpresa];
  return getCachedOrFetch({
    label: "recebimentos.emitidos",
    params,
    ttlMs: options.cacheTtlMs ?? RECEBIMENTOS_TTL_MS,
    enabled: options.useCache !== false,
    fetcher: async () =>
      db.runQuery(await aplicarFiltroVendaRegular(SQL_EMITIDOS_POR_VENDEDOR, "t"), params),
  });
}

async function getDevolucoesRestituicaoPorEmpresa(codEmpresa, dataInicio, dataFim, options = {}) {
  const params = [dataInicio, dataFim, codEmpresa, codEmpresa];
  return getCachedOrFetch({
    label: "recebimentos.devolucoes_restituicao",
    params,
    ttlMs: options.cacheTtlMs ?? RECEBIMENTOS_TTL_MS,
    enabled: options.useCache !== false,
    fetcher: () => db.runQuery(SQL_DEVOLUCOES_RESTITUICAO, params),
  });
}

// --------- APIS PRINCIPAIS ---------
async function getRecebimentosDetalhe({ empresa, dataInicio, dataFim, useCache, cacheTtlMs }) {
  const empresas = parseEmpresasParam(empresa);
  const startedAt = Date.now();
  const results = await Promise.allSettled(
    empresas.map((cod) =>
      getRecebimentosDetalhePorEmpresa(cod, dataInicio, dataFim, { useCache, cacheTtlMs })
    )
  );
  if (LOG_QUERY_TIME) {
    console.log(
      `[RECEBIMENTOS] detalhe empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`
    );
  }
  return coletarResultadosFanout("recebimentos-detalhe", empresas, results, null, "RECEBIMENTOS");
}

/**
 * Agrupa o detalhe por (cod_empresa, cod_vendedor, data_pagamento,
 * forma_categoria, origem), somando valor_recebido e contando parcelas.
 * E o shape que o sync diario (recebimentos_agregado_diario) vai consumir.
 */
function agregarRecebimentos(rows) {
  const mapa = new Map();
  for (const row of rows) {
    const dataPagamento = normalizarDataISO(row.data_pagamento);
    // trim defensivo: CASE no Firebird pode devolver CHAR com padding de
    // espacos (visto na validacao em producao) — sem isso a chave de agregacao
    // e o upsert no Supabase quebrariam.
    const formaCategoria = String(row.forma_categoria ?? "").trim() || null;
    const origem = String(row.origem ?? "").trim() || null;
    const chave = [
      row.cod_empresa,
      row.cod_vendedor,
      dataPagamento,
      formaCategoria,
      origem,
    ].join("|");

    let atual = mapa.get(chave);
    if (!atual) {
      atual = {
        cod_empresa: row.cod_empresa ?? null,
        cod_vendedor: row.cod_vendedor ?? null,
        vendedor_nome: row.vendedor_nome ?? null,
        data_pagamento: dataPagamento,
        forma_categoria: formaCategoria,
        origem: origem,
        valor_recebido: 0,
        qtd_parcelas: 0,
      };
      mapa.set(chave, atual);
    }
    atual.valor_recebido += Number(row.valor_recebido) || 0;
    atual.qtd_parcelas += 1;
  }

  return Array.from(mapa.values()).map((linha) => ({
    ...linha,
    valor_recebido: Math.round(linha.valor_recebido * 100) / 100,
  }));
}

async function getRecebimentosAgregado(args) {
  const { rows, empresasComErro } = await getRecebimentosDetalhe(args);
  return { rows: agregarRecebimentos(rows), empresasComErro };
}

async function getEmitidos({ empresa, dataInicio, dataFim, useCache, cacheTtlMs }) {
  const empresas = parseEmpresasParam(empresa);
  const startedAt = Date.now();
  const results = await Promise.allSettled(
    empresas.map((cod) => getEmitidosPorEmpresa(cod, dataInicio, dataFim, { useCache, cacheTtlMs }))
  );
  if (LOG_QUERY_TIME) {
    console.log(
      `[RECEBIMENTOS] emitidos empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`
    );
  }
  return coletarResultadosFanout("emitidos-por-vendedor", empresas, results, null, "RECEBIMENTOS");
}

async function getDevolucoesRestituicao({ empresa, dataInicio, dataFim, useCache, cacheTtlMs }) {
  // Fallback gracioso: a hipotese de restituicao depende de
  // entradanotafiscaldevolucao(.cod_vendedor); se o schema nao tiver,
  // devolve vazio sem quebrar (PENDENTE VALIDACAO).
  const [temTabela, temVendedor] = await Promise.all([
    hasTable(DEVOLUCAO_TABLE),
    hasColumn(DEVOLUCAO_TABLE, DEVOLUCAO_VENDEDOR_COLUMN),
  ]);
  if (!temTabela || !temVendedor) {
    console.warn(
      `[RECEBIMENTOS] devolucoes-restituicao: schema sem ${DEVOLUCAO_TABLE}.${DEVOLUCAO_VENDEDOR_COLUMN} — retornando vazio (fallback gracioso)`
    );
    return { rows: [], empresasComErro: [] };
  }

  const empresas = parseEmpresasParam(empresa);
  const startedAt = Date.now();
  const results = await Promise.allSettled(
    empresas.map((cod) =>
      getDevolucoesRestituicaoPorEmpresa(cod, dataInicio, dataFim, { useCache, cacheTtlMs })
    )
  );
  if (LOG_QUERY_TIME) {
    console.log(
      `[RECEBIMENTOS] devolucoes-restituicao empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`
    );
  }
  return coletarResultadosFanout(
    "devolucoes-restituicao",
    empresas,
    results,
    null,
    "RECEBIMENTOS"
  );
}

module.exports = {
  getRecebimentosDetalhe,
  getRecebimentosAgregado,
  getEmitidos,
  getDevolucoesRestituicao,
  // exposto para testes e para o script de validacao
  agregarRecebimentos,
};
