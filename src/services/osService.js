// src/services/osService.js

const path = require("path");
const fs = require("fs");
const db = require("../db");

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "os", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlMonitorOs = loadSql("monitor.sql");

/**
 * Monitor de OS por período e empresa opcional.
 * @param {Object} params
 * @param {string} params.dataInicio
 * @param {string} params.dataFim
 * @param {number|null} params.codEmpresa
 */
async function getMonitorOs({ dataInicio, dataFim, codEmpresa }) {
  const empresaParam = codEmpresa ?? null;
  const params = [dataInicio, dataFim, empresaParam, empresaParam];

  const rows = await db.query(sqlMonitorOs, params);
  return rows;
}

module.exports = {
  getMonitorOs,
};
