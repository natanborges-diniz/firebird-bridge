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
const SQL_SALDOS_EM_ABERTO = loadSql("saldos_em_aberto.sql");

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

/**
 * FATURA COMPARTILHADA (aferido em producao, 2026-08): uma venda pode ter N
 * transacoes ligadas a MESMA fatura (mesmo numerotransacao); como as parcelas
 * sao da FATURA, o SQL devolve cada parcela uma vez POR transacao — duplicando
 * a base de comissao (ex.: loja 1 jun/2026, R$ 12,7 mil duplicados em 5
 * vendas). Corrigir no SQL via subquery canonica estoura timeout (sem indice
 * em transacao.cod_faturatransacao), entao a deduplicacao e feita aqui:
 * mantem so as linhas da transacao canonica (menor cod_transacao da fatura) e
 * agrega o os_list de todas as transacoes da fatura na linha mantida.
 */
function dedupeFaturaCompartilhada(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  // 1) canonico e uniao de OS por fatura
  const porFatura = new Map();
  for (const row of rows) {
    const fatura = row.cod_fatura;
    if (fatura === null || fatura === undefined) continue;
    const chave = `${fatura}|${row.cod_empresa}`;
    let info = porFatura.get(chave);
    if (!info) {
      info = {
        minTransacao: row.cod_transacao,
        transacoes: new Set(),
        os: new Set(),
        emitidoPorTransacao: new Map(),
      };
      porFatura.set(chave, info);
    }
    info.transacoes.add(row.cod_transacao);
    // valor_emitido e por TRANSACAO; a fatura compartilhada precisa da soma
    // das transacoes irmas (senao o corte de juros ve excedente falso)
    if (row.valor_emitido !== undefined) {
      info.emitidoPorTransacao.set(row.cod_transacao, Number(row.valor_emitido) || 0);
    }
    if (row.cod_transacao < info.minTransacao) info.minTransacao = row.cod_transacao;
    const osList = String(row.os_list ?? "").trim();
    if (osList && osList !== "SEM_OS") {
      osList.split(",").forEach((os) => {
        const limpo = os.trim();
        if (limpo) info.os.add(limpo);
      });
    }
  }

  // 2) fica so a transacao canonica; os_list vira a uniao das OS da fatura
  const resultado = [];
  for (const row of rows) {
    const fatura = row.cod_fatura;
    if (fatura === null || fatura === undefined) {
      resultado.push(row);
      continue;
    }
    const info = porFatura.get(`${fatura}|${row.cod_empresa}`);
    if (info.transacoes.size > 1 && row.cod_transacao !== info.minTransacao) continue;
    if (info.transacoes.size > 1) {
      const emitidoFatura = Array.from(info.emitidoPorTransacao.values()).reduce((s, v) => s + v, 0);
      resultado.push({
        ...row,
        os_list: info.os.size > 0 ? Array.from(info.os).join(",") : row.os_list,
        ...(row.valor_emitido !== undefined ? { valor_emitido: emitidoFatura } : {}),
      });
    } else {
      resultado.push(row);
    }
  }
  return resultado;
}

/**
 * CORTE DE JUROS DE PARCELAMENTO (Natan, 2026-08-02): comissao e meta sobre o
 * VALOR DA VENDA, nunca sobre acrescimos. O acrescimo do parcelado fica
 * EMBUTIDO no valor das parcelas (flp.juros = 0; ex.: venda 87135 loja 1 —
 * emitido 238,99, parcelas 7x40,63 = 284,38). Deteccao por fatura:
 * excedente = fatura_previsto (soma de todas as parcelas) - valor_emitido.
 * O excedente e abatido proporcionalmente das linhas de CARTAO_CREDITO da
 * fatura (onde o acrescimo nasce); se nao houver, de todas as linhas.
 */
function abaterJurosParcelamento(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const fatorPorFatura = new Map();
  const porFatura = new Map();
  for (const row of rows) {
    const chave = `${row.cod_fatura}|${row.cod_empresa}`;
    if (!porFatura.has(chave)) porFatura.set(chave, []);
    porFatura.get(chave).push(row);
  }
  for (const [chave, grupo] of porFatura) {
    const emitido = Number(grupo[0].valor_emitido) || 0;
    const previsto = Number(grupo[0].fatura_previsto) || 0;
    if (emitido <= 0 || previsto <= emitido + 0.01) continue; // sem juros
    const excedente = previsto - emitido;
    // so abate quando as linhas de cartao credito da fatura estao presentes
    // no resultado (vendas do periodo, bloco A); em vendas antigas cujas
    // linhas de cartao nao foram buscadas, abater das outras formas seria
    // penalizar a parcela errada
    const cartoes = grupo.filter((r) => String(r.forma_categoria ?? "").trim() === "CARTAO_CREDITO");
    if (!cartoes.length) continue;
    const somaAlvo = cartoes.reduce((s, r) => s + (Number(r.valor_recebido) || 0), 0);
    if (somaAlvo <= 0) continue;
    // abate limitado ao que esta no alvo (nunca deixa valor negativo)
    const fator = Math.max(0, 1 - Math.min(excedente, somaAlvo) / somaAlvo);
    fatorPorFatura.set(chave, { fator, alvoCartao: true });
  }
  if (!fatorPorFatura.size) return rows;

  return rows.map((row) => {
    const chave = `${row.cod_fatura}|${row.cod_empresa}`;
    const ajuste = fatorPorFatura.get(chave);
    if (!ajuste) return row;
    const ehCartao = String(row.forma_categoria ?? "").trim() === "CARTAO_CREDITO";
    if (ajuste.alvoCartao && !ehCartao) return row;
    const valor = Math.round((Number(row.valor_recebido) || 0) * ajuste.fator * 100) / 100;
    return { ...row, valor_recebido: valor };
  });
}

// --------- QUERIES POR EMPRESA ---------
async function getRecebimentosDetalhePorEmpresa(codEmpresa, dataInicio, dataFim, options = {}) {
  // ordem dos parametros = ordem dos "?" no SQL:
  // origem (dataIni), datapagamento ini/fim, empresa, empresa (regra 13/18)
  // Bloco A (cartoes por emissao): dataIni, dataFim, emp, emp
  // Bloco B (demais por pagamento): dataIni(origem), dataIni, dataFim, emp, emp
  const params = [
    dataInicio, dataFim, codEmpresa, codEmpresa,
    dataInicio, dataInicio, dataFim, codEmpresa, codEmpresa,
  ];
  return getCachedOrFetch({
    label: "recebimentos.detalhe",
    params,
    ttlMs: options.cacheTtlMs ?? RECEBIMENTOS_TTL_MS,
    enabled: options.useCache !== false,
    fetcher: async () =>
      abaterJurosParcelamento(
        dedupeFaturaCompartilhada(
          await db.runQuery(await aplicarFiltroVendaRegular(SQL_RECEBIMENTOS_DETALHE, "t"), params)
        )
      ),
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
async function getSaldosAbertosPorEmpresa(codEmpresa, dataInicio, dataFim, options = {}) {
  const params = [dataInicio, dataFim, codEmpresa, codEmpresa];
  return getCachedOrFetch({
    label: "recebimentos.saldos_aberto",
    params,
    ttlMs: options.cacheTtlMs ?? RECEBIMENTOS_TTL_MS,
    enabled: options.useCache !== false,
    fetcher: async () =>
      dedupeFaturaCompartilhada(
        await db.runQuery(await aplicarFiltroVendaRegular(SQL_SALDOS_EM_ABERTO, "t"), params)
      ),
  });
}

async function getSaldosAbertos({ empresa, dataInicio, dataFim, useCache, cacheTtlMs }) {
  const empresas = parseEmpresasParam(empresa);
  const results = await Promise.allSettled(
    empresas.map((cod) =>
      getSaldosAbertosPorEmpresa(cod, dataInicio, dataFim, { useCache, cacheTtlMs })
    )
  );
  return coletarResultadosFanout("recebimentos-saldos-aberto", empresas, results, null, "RECEBIMENTOS");
}

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
        vendedor_nome: String(row.vendedor_nome ?? "").trim() || null,
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
  getSaldosAbertos,
  getRecebimentosDetalhe,
  getRecebimentosAgregado,
  getEmitidos,
  getDevolucoesRestituicao,
  // exposto para testes e para o script de validacao
  agregarRecebimentos,
  dedupeFaturaCompartilhada,
  abaterJurosParcelamento,
};
