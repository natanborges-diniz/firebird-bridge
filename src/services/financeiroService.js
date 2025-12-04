// src/services/financeiroService.js
const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", fileName);
  return fs.readFileSync(filePath, "utf8");
}

// importante: caminho com subpasta "financeiro"
const sqlParcelas = loadSql("financeiro/financeiro_parcelas.sql");

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  // ORDEM DOS PARÂMETROS PRECISA COMBINAR COM A QUERY:
  // where
  //   fl.cod_empresa = ?
  //   and fp.datavencimento between ? and ?
  const params = [Number(codEmpresa), dataIni, dataFim];

  const rows = await db.query(sqlParcelas, params);
  return rows;
}

module.exports = {
  getParcelas,
};
