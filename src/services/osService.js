const path = require("path");
const fs = require("fs");
const db = require("../db");

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "os", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlMonitorOs = loadSql("monitor.sql");
const sqlMonitorOsUltimaEtapa = loadSql("monitor_ultima_etapa.sql");
const sqlHubReceitas = loadSql("hub_receitas.sql");
const OSL_TABLE_NAME = "ORDEMSERVICOOTICALENTE";
const OSL_JOIN_COLUMN_NAME = "COD_ORDEMSERVICOCAIXA";
const oslJoinPattern =
  /OSL\.COD_ORDEMSERVICOCAIXA\s*=\s*OCX\.COD_ORDEMSERVICOCAIXA/i;
const sqlHubReceitasFallback = sqlHubReceitas.replace(
  oslJoinPattern,
  "osl.cod_transacao = ocx.cod_transacao"
);
const hasFallbackJoin = sqlHubReceitasFallback !== sqlHubReceitas;
const fallbackJoinErrorMessage = `Join condition matching pattern ${oslJoinPattern} not found in hub_receitas.sql.`;
// Disable caching with DISABLE_METADATA_CACHE=true; tests skip cache for isolation.
const enableMetadataCache =
  process.env.DISABLE_METADATA_CACHE !== "true" &&
  process.env.NODE_ENV !== "test";
// Schema changes require an application restart to refresh this cache.
let cachedHasOslCodOrdemServicoCaixa = null;

async function hasOslCodOrdemServicoCaixa() {
  if (enableMetadataCache && cachedHasOslCodOrdemServicoCaixa !== null) {
    return cachedHasOslCodOrdemServicoCaixa;
  }

  let rows;
  try {
    rows = await db.query(
      `
        SELECT 1
        FROM rdb$relation_fields rf
        JOIN rdb$relations r
          ON r.rdb$relation_name = rf.rdb$relation_name
        WHERE r.rdb$system_flag = 0
          AND TRIM(rf.rdb$relation_name) = ?
          AND TRIM(rf.rdb$field_name) = ?
      `,
      [OSL_TABLE_NAME, OSL_JOIN_COLUMN_NAME]
    );
  } catch (err) {
    throw new Error(
      `Metadata lookup failed for ${OSL_TABLE_NAME}.${OSL_JOIN_COLUMN_NAME}: ${err.message}`
    );
  }
  const hasColumn = rows.length > 0;
  if (enableMetadataCache) {
    cachedHasOslCodOrdemServicoCaixa = hasColumn;
  }
  return hasColumn;
}

async function getMonitorOs({ dataInicio, dataFim, codEmpresa }) {
  const empresaParam = codEmpresa ?? null;
  const params = [dataInicio, dataFim, empresaParam, empresaParam];
  return db.query(sqlMonitorOs, params);
}

async function getMonitorOsUltimaEtapa({ dataInicio, dataFim, codEmpresa }) {
  const empresaParam = codEmpresa ?? null;
  const params = [dataInicio, dataFim, empresaParam, empresaParam];
  return db.query(sqlMonitorOsUltimaEtapa, params);
}

async function getHubReceitas({ dataInicio, dataFim, codEmpresa, os }) {
  const empresaParam = codEmpresa ?? null;
  const osParam = os ?? null;
  const params = [osParam, osParam, dataInicio, dataFim, empresaParam, empresaParam];
  const useCodOs = await hasOslCodOrdemServicoCaixa();
  if (!useCodOs && !hasFallbackJoin) {
    throw new Error(fallbackJoinErrorMessage);
  }
  const sql =
    useCodOs || !hasFallbackJoin ? sqlHubReceitas : sqlHubReceitasFallback;
  return db.query(sql, params);
}

async function getHubReceitasCompleto({ os, codEmpresa }) {
  const empresaParam = codEmpresa ?? null;
  const osRows = await db.query(
    `
      SELECT *
      FROM ordemservicocaixa
      WHERE numeroordemservico = CAST(? AS INTEGER)
        AND ( ? IS NULL OR cod_empresaorigem = CAST(? AS INTEGER) )
    `,
    [os, empresaParam, empresaParam]
  );

  if (osRows.length === 0) {
    return {
      ordem_servico: null,
      receita_otica: [],
      receita_lente: [],
      receita_otica_lente: [],
    };
  }

  const osRow = osRows[0];
  const codOs = osRow.cod_ordemservicocaixa;
  const codTransacao = osRow.cod_transacao;

  const receitaOtica = await db.query(
    `SELECT * FROM otiordemservicootica WHERE cod_ordemservicocaixa = ?`,
    [codOs]
  );

  const receitaLente = await db.query(
    `SELECT * FROM ordemservicooticalente WHERE cod_transacao = ?`,
    [codTransacao]
  );

  const receitaOticaLente = await db.query(
    `SELECT * FROM otiordemservicootica_lente WHERE cod_transacao = ?`,
    [codTransacao]
  );

  return {
    ordem_servico: osRow,
    receita_otica: receitaOtica,
    receita_lente: receitaLente,
    receita_otica_lente: receitaOticaLente,
  };
}

async function getReceitaMetadata({ campos, chavesOs, includeAllFields }) {
  const camposUpper = campos
    .map((campo) => String(campo || "").trim())
    .filter(Boolean)
    .map((campo) => campo.toUpperCase());

  const chavesOsUpper = chavesOs
    .map((campo) => String(campo || "").trim())
    .filter(Boolean)
    .map((campo) => campo.toUpperCase());

  const lookupFields = [...new Set([...camposUpper, ...chavesOsUpper])];

  if (lookupFields.length === 0) {
    return { matches: [], fieldsByTable: null };
  }

  const placeholders = lookupFields.map(() => "?").join(", ");
  const sql = `
    SELECT
      TRIM(rf.rdb$relation_name) AS tabela,
      TRIM(rf.rdb$field_name) AS campo
    FROM rdb$relation_fields rf
    JOIN rdb$relations r
      ON r.rdb$relation_name = rf.rdb$relation_name
    WHERE r.rdb$system_flag = 0
      AND UPPER(rf.rdb$field_name) IN (${placeholders})
    ORDER BY tabela, campo
  `;

  const matches = await db.query(sql, lookupFields);

  if (!includeAllFields || matches.length === 0) {
    return { matches, fieldsByTable: null };
  }

  const tabelas = [...new Set(matches.map((row) => row.tabela))];
  const tablePlaceholders = tabelas.map(() => "?").join(", ");
  const sqlFields = `
    SELECT
      TRIM(rf.rdb$relation_name) AS tabela,
      TRIM(rf.rdb$field_name) AS campo
    FROM rdb$relation_fields rf
    JOIN rdb$relations r
      ON r.rdb$relation_name = rf.rdb$relation_name
    WHERE r.rdb$system_flag = 0
      AND rf.rdb$relation_name IN (${tablePlaceholders})
    ORDER BY tabela, campo
  `;

  const fieldsRows = await db.query(sqlFields, tabelas);
  const fieldsByTable = fieldsRows.reduce((acc, row) => {
    if (!acc[row.tabela]) {
      acc[row.tabela] = [];
    }
    acc[row.tabela].push(row.campo);
    return acc;
  }, {});

  return { matches, fieldsByTable };
}

module.exports = {
  getMonitorOs,
  getMonitorOsUltimaEtapa,
  getHubReceitas,
  getHubReceitasCompleto,
  getReceitaMetadata,
};
