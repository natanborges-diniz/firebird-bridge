// src/services/financeiroService.js

const path = require("path");
const fs = require("fs");
const { runQuery } = require("../db"); // db/index.js

// Monta o caminho absoluto para /queries/financeiro/financeiro_parcelas.sql
const sqlParcelas = fs.readFileSync(
  path.join(__dirname, "..", "queries", "financeiro", "financeiro_parcelas.sql"),
  "utf8"
);

console.log("[FinanceiroService] Usando SQL em:", sqlParcelasPath);

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  const params = [dataIni, dataFim, codEmpresa];
  const rows = await db.query(sqlParcelas, params);
  return rows;
}

module.exports = {
  getParcelas,
};
