// src/services/crmService.js
const path = require("path");
const fs = require("fs");
const db = require("../db");

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "crm", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlBaseClientesEntrega = loadSql("base_clientes_entrega.sql");
const sqlEntregasPorData     = loadSql("entregas_por_data.sql");
const sqlAniversariantes     = loadSql("aniversariantes.sql");
const sqlVenda               = loadSql("venda.sql");

const PESSOA_TABLE_NAME = "PESSOA";
const OPCIONAIS_PLACEHOLDER          = "/*__COLUNAS_OPCIONAIS__*/";
const DATA_NASCIMENTO_PLACEHOLDER    = "/*__DATA_NASCIMENTO__*/";
const GROUP_DATA_NASCIMENTO_PLACEHOLDER = "/*__GROUP_DATA_NASCIMENTO__*/";

// OS de garantia/reparo (nao sao venda) possuem linha em
// vendagarantia_item. Usamos isso para exclui-las da base.
const VENDA_GARANTIA_TABLE_NAME = "VENDAGARANTIA_ITEM";
const VENDA_GARANTIA_OS_COLUMN_NAME = "COD_ORDEMSERVICOCAIXA";
const FILTRO_OS_REGULAR_PLACEHOLDER = "/*__FILTRO_OS_REGULAR__*/";
const FILTRO_OS_REGULAR_SQL =
  "AND NOT EXISTS (\n" +
  "        SELECT 1\n" +
  "          FROM vendagarantia_item vgi\n" +
  "         WHERE vgi.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa\n" +
  "      )";

/**
 * Colunas opcionais de endereço/contato da tabela PESSOA.
 * São incluídas no SELECT apenas se existirem no schema real
 * (checagem via rdb$relation_fields). Como os nomes podem variar
 * entre versões do ERP/Dataweb, cada alias lista candidatos em
 * ordem de preferência; o primeiro que existir é usado.
 *
 *   alias  -> [candidatos de coluna...]
 */
// [alias, [candidatos de coluna...], tipo]
//   tipo "email" -> mantido so com formato minimo (x@y.z)
//   tipo "texto" -> TRIM + NULLIF (vazio vira NULL)
const COLUNAS_OPCIONAIS = [
  ["email", ["EMAIL"], "email"],
  ["endereco", ["ENDERECO", "LOGRADOURO"], "texto"],
  ["numero", ["NUMERO"], "texto"],
  ["complemento", ["COMPLEMENTO"], "texto"],
  ["bairro", ["BAIRRO"], "texto"],
  ["cep", ["CEP"], "texto"],
  ["cidade", ["CIDADE", "MUNICIPIO"], "texto"],
  ["uf", ["UF", "ESTADO"], "texto"],
];

/** Monta a expressao SQL (com limpeza) de uma coluna opcional. */
function exprColunaOpcional(alias, coluna, tipo) {
  const c = `pc.${coluna.toLowerCase()}`;
  if (tipo === "email") {
    return `CASE WHEN TRIM(${c}) LIKE '%@%.%' THEN TRIM(${c}) ELSE NULL END AS ${alias}`;
  }
  return `NULLIF(TRIM(${c}), '') AS ${alias}`;
}

// Cache de metadados (schema só muda com restart da aplicação).
const enableMetadataCache = process.env.NODE_ENV !== "test";
const columnLookupCache = new Map();
let cachedColunasOpcionaisSql = null;
let cachedDataNascimentoExists = null;

/**
 * Verifica se uma coluna existe em uma tabela do Firebird
 * consultando o catálogo de sistema rdb$relation_fields.
 * Mesmo mecanismo usado em osService.js.
 */
async function hasColumn(tableName, columnName) {
  const cacheKey = `${tableName}.${columnName}`;
  if (enableMetadataCache && columnLookupCache.has(cacheKey)) {
    return columnLookupCache.get(cacheKey);
  }

  const rows = await db.query(
    `
      SELECT 1
      FROM rdb$relation_fields rf
      JOIN rdb$relations r
        ON r.rdb$relation_name = rf.rdb$relation_name
      WHERE r.rdb$system_flag = 0
        AND TRIM(rf.rdb$relation_name) = ?
        AND TRIM(rf.rdb$field_name) = ?
    `,
    [tableName, columnName]
  );

  const exists = rows.length > 0;
  if (enableMetadataCache) {
    columnLookupCache.set(cacheKey, exists);
  }
  return exists;
}

/**
 * Monta o trecho de SELECT com as colunas opcionais que
 * realmente existem no schema. Retorna "" se nenhuma existir.
 */
async function buildColunasOpcionaisSql() {
  if (enableMetadataCache && cachedColunasOpcionaisSql !== null) {
    return cachedColunasOpcionaisSql;
  }

  const pedacos = [];

  for (const [alias, candidatos, tipo] of COLUNAS_OPCIONAIS) {
    for (const coluna of candidatos) {
      // eslint-disable-next-line no-await-in-loop
      const existe = await hasColumn(PESSOA_TABLE_NAME, coluna);
      if (existe) {
        pedacos.push(exprColunaOpcional(alias, coluna, tipo));
        break; // usa o primeiro candidato que existir
      }
    }
  }

  const sql = pedacos.length ? `,\n    ${pedacos.join(",\n    ")}` : "";

  if (enableMetadataCache) {
    cachedColunasOpcionaisSql = sql;
  }
  return sql;
}

/**
 * Verifica se PESSOA.DATANASCIMENTO existe (coluna opcional em alguns schemas).
 * Retorna o trecho SQL para o SELECT e o GROUP BY, ou strings vazias.
 */
async function buildDataNascimentoSql() {
  if (enableMetadataCache && cachedDataNascimentoExists !== null) {
    return cachedDataNascimentoExists;
  }

  const existe = await hasColumn(PESSOA_TABLE_NAME, "DATANASCIMENTO");
  const result = {
    select: existe ? ",\n  pc.datanascimento AS data_nascimento" : "",
    group:  existe ? ",\n  pc.datanascimento" : "",
  };

  if (enableMetadataCache) {
    cachedDataNascimentoExists = result;
  }
  return result;
}

/**
 * Monta o filtro que exclui OS de garantia/reparo (que nao sao
 * venda). Retorna "" caso a tabela vendagarantia_item nao exista
 * no schema, mantendo a query funcional.
 */
async function buildFiltroOsRegularSql() {
  const temVendaGarantia = await hasColumn(
    VENDA_GARANTIA_TABLE_NAME,
    VENDA_GARANTIA_OS_COLUMN_NAME
  );
  return temVendaGarantia ? FILTRO_OS_REGULAR_SQL : "";
}

/**
 * Deduplica clientes por CPF, mantendo o registro de maior
 * cod_cliente (cadastro mais recente) por CPF. Clientes sem CPF
 * sao todos preservados (sao pessoas distintas desconhecidas).
 * A ordem original (ORDER BY do SQL) e preservada.
 */
function dedupPorCpf(rows) {
  const normalizaCpf = (r) => (r.cpf == null ? "" : String(r.cpf).trim());

  // 1) descobre, por CPF, o maior cod_cliente
  const melhorCodPorCpf = new Map();
  for (const r of rows) {
    const cpf = normalizaCpf(r);
    if (!cpf) continue;
    const cod = r.cod_cliente ?? 0;
    const atual = melhorCodPorCpf.get(cpf);
    if (atual === undefined || cod > atual) {
      melhorCodPorCpf.set(cpf, cod);
    }
  }

  // 2) mantem so o vencedor de cada CPF (e todos sem CPF)
  const vistos = new Set();
  return rows.filter((r) => {
    const cpf = normalizaCpf(r);
    if (!cpf) return true;
    if ((r.cod_cliente ?? 0) !== melhorCodPorCpf.get(cpf)) return false;
    if (vistos.has(cpf)) return false; // empate de cod_cliente: fica o 1o
    vistos.add(cpf);
    return true;
  });
}

/**
 * Retorna a base de clientes para entrega de uma empresa,
 * considerando apenas OS regulares de venda (garantia/reparo
 * sao desconsideradas) e deduplicada por CPF.
 * @param {{ codEmpresa: number|null }} params
 */
async function getBaseClientesEntrega({ codEmpresa = null } = {}) {
  const empresaParam = codEmpresa ?? null;

  const [colunasOpcionais, filtroOsRegular] = await Promise.all([
    buildColunasOpcionaisSql(),
    buildFiltroOsRegularSql(),
  ]);

  const sql = sqlBaseClientesEntrega
    .replace(OPCIONAIS_PLACEHOLDER, colunasOpcionais)
    .replace(FILTRO_OS_REGULAR_PLACEHOLDER, filtroOsRegular);

  const params = [empresaParam, empresaParam];
  const rows = await db.query(sql, params);
  return dedupPorCpf(rows);
}

/**
 * Retorna clientes com OS entregue (etapa 08) dentro do intervalo
 * [dataIni, dataFim], filtrado por empresa.
 * Um registro por (cod_cliente, data_entrega), deduplicado por CPF.
 *
 * @param {{ codEmpresa: number|null, dataIni: string, dataFim: string }} params
 *   dataIni/dataFim: strings ISO (YYYY-MM-DD)
 */
async function getEntregasPorData({ codEmpresa = null, dataIni, dataFim } = {}) {
  if (!dataIni || !dataFim) {
    throw new Error("dataIni e dataFim são obrigatórios");
  }

  const empresaParam = codEmpresa ?? null;
  const [dataNasc, filtroOsRegular] = await Promise.all([
    buildDataNascimentoSql(),
    buildFiltroOsRegularSql(),
  ]);

  const sql = sqlEntregasPorData
    .replace(DATA_NASCIMENTO_PLACEHOLDER, dataNasc.select)
    .replace(FILTRO_OS_REGULAR_PLACEHOLDER, filtroOsRegular);

  // Parâmetros: dataIni, dataFim (filtro log), empresa, empresa (filtro ocx)
  const params = [dataIni, dataFim, empresaParam, empresaParam];
  const rows = await db.query(sql, params);
  return dedupPorCpf(rows);
}

/**
 * Retorna clientes aniversariantes na data alvo (mês+dia),
 * filtrado por empresa. Deduplicado por CPF.
 *
 * @param {{ codEmpresa: number|null, dataAlvo: string }} params
 *   dataAlvo: string ISO (YYYY-MM-DD)
 */
async function getAniversariantes({ codEmpresa = null, dataAlvo } = {}) {
  if (!dataAlvo) {
    throw new Error("dataAlvo é obrigatório");
  }

  const empresaParam = codEmpresa ?? null;
  const [dataNasc, filtroOsRegular] = await Promise.all([
    buildDataNascimentoSql(),
    buildFiltroOsRegularSql(),
  ]);

  // aniversariantes.sql usa /*__DATA_NASCIMENTO__*/ no SELECT e
  // /*__GROUP_DATA_NASCIMENTO__*/ no GROUP BY
  const sql = sqlAniversariantes
    .replace(DATA_NASCIMENTO_PLACEHOLDER, dataNasc.select)
    .replace(GROUP_DATA_NASCIMENTO_PLACEHOLDER, dataNasc.group)
    .replace(FILTRO_OS_REGULAR_PLACEHOLDER, filtroOsRegular);

  // Parâmetros: dataAlvo (MONTH), dataAlvo (DAY), empresa, empresa
  const params = [dataAlvo, dataAlvo, empresaParam, empresaParam];
  const rows = await db.query(sql, params);
  return dedupPorCpf(rows);
}

/**
 * SQL para lookup de NUMEROVENDA → cod_venda na tabela VENDA.
 * A tabela VENDA é uma extensão POS-específica de TRANSACAO
 * (cod_venda = cod_transacao). NUMEROVENDA é uma sequência
 * independente de TRANSACAO.NUMEROTRANSACAO.
 */
const SQL_LOOKUP_VENDA = `
  SELECT FIRST 1
    v.cod_venda,
    v.numerovenda,
    t.total
  FROM venda v
  JOIN transacao t ON t.cod_transacao = v.cod_venda
  WHERE v.numerovenda = CAST(? AS INTEGER)
    AND (? IS NULL OR v.cod_empresa = CAST(? AS INTEGER))
`;

const SQL_LOOKUP_OS = `
  SELECT FIRST 1
    ocx.cod_transacao AS cod_venda,
    t.total
  FROM ordemservicocaixa ocx
  JOIN transacao t ON t.cod_transacao = ocx.cod_transacao
  WHERE ocx.numeroordemservico = CAST(? AS INTEGER)
    AND (? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER))
`;

/**
 * Retorna o cabeçalho + lista de OS de uma venda.
 *
 * Lookup primário: VENDA.NUMEROVENDA.
 * Fallback:        ORDEMSERVICOCAIXA.NUMEROORDEMSERVICO.
 *
 * Retorna null se não encontrado.
 *
 * @param {{ numero: number|string, codEmpresa: number|null }} params
 */
async function getVenda({ numero, codEmpresa = null } = {}) {
  if (numero === undefined || numero === null) {
    throw new Error("numero é obrigatório");
  }

  const numeroInt = parseInt(numero, 10);
  if (!Number.isFinite(numeroInt)) {
    throw new Error("numero deve ser inteiro");
  }

  const empresaParam = codEmpresa ?? null;

  // 1. Lookup por NUMEROVENDA (primary)
  const vendaRows = await db.query(SQL_LOOKUP_VENDA, [
    numeroInt,
    empresaParam,
    empresaParam,
  ]);

  let codVenda, numerovenda, valorTotal;

  if (vendaRows.length > 0) {
    ({ cod_venda: codVenda, numerovenda, total: valorTotal } = vendaRows[0]);
  } else {
    // 2. Fallback: lookup por NUMEROORDEMSERVICO
    const osLookup = await db.query(SQL_LOOKUP_OS, [
      numeroInt,
      empresaParam,
      empresaParam,
    ]);

    if (osLookup.length === 0) return null;
    codVenda   = osLookup[0].cod_venda;
    valorTotal = osLookup[0].total;
    numerovenda = null;
  }

  // 3. Busca detalhes das OS
  const [dataNasc, filtroOsRegular] = await Promise.all([
    buildDataNascimentoSql(),
    buildFiltroOsRegularSql(),
  ]);

  const sql = sqlVenda
    .replace(DATA_NASCIMENTO_PLACEHOLDER, dataNasc.select)
    .replace(FILTRO_OS_REGULAR_PLACEHOLDER, filtroOsRegular);

  // 5 parâmetros: cada CTE e o WHERE principal recebem cod_venda
  const params = Array(5).fill(codVenda);
  const osRows = await db.query(sql, params);

  return {
    numerovenda: numerovenda ?? numeroInt,
    valor_total: valorTotal,
    os: osRows,
  };
}

module.exports = {
  getBaseClientesEntrega,
  getEntregasPorData,
  getAniversariantes,
  getVenda,
  // exportado para testes/inspeção
  hasColumn,
  buildColunasOpcionaisSql,
  buildDataNascimentoSql,
  buildFiltroOsRegularSql,
  dedupPorCpf,
};
