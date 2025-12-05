// src/services/financeiroService.js
// Serviço de acesso ao módulo financeiro direto no Firebird

// src/services/financeiroService.js

const path = require("path");
const fs = require("fs");
const db = require("../db");

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlParcelas = loadSql("financeiro/financeiro_parcelas.sql");

async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  const params = [dataIni, dataFim, codEmpresa];
  const rows = await db.query(sqlParcelas, params);
  return rows;
}

module.exports = {
  getParcelas,
};
