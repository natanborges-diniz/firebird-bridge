// src/services/financeiroService.js

const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js

// Monta o caminho absoluto para /queries/financeiro/financeiro_parcelas.sql
const sqlParcelasPath = path.join(
  __dirname,
  "..",      // -> /app/src
  "..",      // -> /app
  "queries",
  "financeiro",
  "financeiro_parcelas.sql"
);

console.log("[FinanceiroService] Usando SQL em:", sqlParcelasPath);

const sqlParcelas = fs.readFileSync(sqlParcelasPath, "utf8");

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
