// src/services/financeiroService.js
const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", fileName);
  return fs.readFileSync(filePath, "utf8");
}

// Query principal de parcelas
const sqlParcelas = loadSql("financeiro/financeiro_parcelas.sql");

// Query de DEBUG: resumo por empresa
const sqlResumoPorEmpresa = loadSql("financeiro/financeiro_resumo_por_empresa.sql");

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  // Ordem dos parâmetros precisa bater com a query:
  // where fl.cod_empresa = ? and fp.datavencimento between ? and ?
  const params = [Number(codEmpresa), dataIni, dataFim];
  const rows = await db.query(sqlParcelas, params);
  return rows;
}

/**
 * DEBUG: resumo de parcelas por empresa, com min/max datavencimento
 */
async function getResumoPorEmpresa() {
  const rows = await db.query(sqlResumoPorEmpresa, []);
  return rows;
}

module.exports = {
  getParcelas,
  getResumoPorEmpresa,
};
