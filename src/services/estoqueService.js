// src/services/estoqueService.js
const path = require("path");
const fs = require("fs");
const db = require("../db"); // expõe db.query

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "estoque", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlAnaliseEstoqueAcao = loadSql("analise_estoque_acao.sql");

/**
 * Análise de estoque com ação sugerida por empresa.
 * @param {number|string} codEmpresa
 */
async function getAnaliseEstoqueAcao(codEmpresa) {
  const params = [codEmpresa];
  const rows = await db.query(sqlAnaliseEstoqueAcao, params);
  return rows;
}

module.exports = {
  getAnaliseEstoqueAcao
};
