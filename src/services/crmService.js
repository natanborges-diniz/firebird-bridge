// src/services/crmService.js
const path = require("path");
const fs = require("fs");
const db = require("../db");

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "crm", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlBaseClientesEntrega = loadSql("base_clientes_entrega.sql");

const PESSOA_TABLE_NAME = "PESSOA";
const OPCIONAIS_PLACEHOLDER = "/*__COLUNAS_OPCIONAIS__*/";

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

module.exports = {
  getBaseClientesEntrega,
  // exportado para testes/inspeção
  hasColumn,
  buildColunasOpcionaisSql,
  buildFiltroOsRegularSql,
  dedupPorCpf,
};
