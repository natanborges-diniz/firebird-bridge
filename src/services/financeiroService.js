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
function parseDateParam(str) {
  // Espera formato 'YYYY-MM-DD'
  // Ex: '2025-01-01' → new Date(2025, 0, 1)
  if (!str) return null;
  const [year, month, day] = str.split("-").map(Number);
  return new Date(year, month - 1, day);
}

async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  const dataIniDate = parseDateParam(dataIni);
  const dataFimDate = parseDateParam(dataFim);

  const params = [
    dataIniDate,
    dataFimDate,
    Number(codEmpresa), // garante numérico
  ];

  const rows = await runQuery(sqlParcelas, params);
  return rows;
}

module.exports = {
  getParcelas,
};
