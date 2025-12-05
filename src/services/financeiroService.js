// src/services/financeiroService.js
// Serviço de acesso ao módulo financeiro direto no Firebird

const path = require("path");
const fs = require("fs");
const { runQuery } = require("../db"); // usa o db/index.js do bridge

// Carrega o SQL da pasta /queries/financeiro
const sqlParcelas = fs.readFileSync(
  path.join(__dirname, "..", "queries", "financeiro_parcelas.sql"),
  "utf8"
);

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {Object} params
 * @param {string} params.dataIni - 'YYYY-MM-DD'
 * @param {string} params.dataFim - 'YYYY-MM-DD'
 * @param {number|string} params.codEmpresa
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  const params = [dataIni, dataFim, codEmpresa];
  const rows = await runQuery(sqlParcelas, params);
  return rows;
}

module.exports = {
  getParcelas,
};
