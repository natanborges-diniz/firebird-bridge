// src/services/financeiroService.js
const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", fileName);
  return fs.readFileSync(filePath, "utf8");
}

// 👇 repara neste caminho
const sqlParcelas = loadSql("financeiro/financeiro_parcelas.sql");

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  // mesmo formato de data (YYYY-MM-DD), só mudamos a ordem
  const params = [codEmpresa, dataIni, dataFim];
  const rows = await db.query(sqlParcelas, params);
  return rows;
}

module.exports = {
  getParcelas,
};
