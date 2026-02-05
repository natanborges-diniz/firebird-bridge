const path = require("path");
const fs = require("fs");
const db = require("../db");

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "os", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlMonitorOs = loadSql("monitor.sql");
const sqlMonitorOsUltimaEtapa = loadSql("monitor_ultima_etapa.sql");

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
  getReceitaMetadata,
};
