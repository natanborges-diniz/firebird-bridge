// src/services/financeiroService.js
const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js

function loadSql(fileName) {
  // sobe de /src/services para /src -> .., depois / -> ..
  const filePath = path.join(__dirname, "..", "..", "queries", "financeiro", fileName);
  return fs.readFileSync(filePath, "utf8");
}

// aqui mantemos a pasta /queries/financeiro
const sqlParcelas = loadSql("financeiro_parcelas.sql");

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  // ORDEM dos parâmetros precisa bater com o SQL:
  // where fl.cod_empresa = ?
  //   and fp.datavencimento between ? and ?
  const params = [codEmpresa, dataIni, dataFim];

  const rows = await db.query(sqlParcelas, params);
  return rows;
}

module.exports = {
  getParcelas,
};
