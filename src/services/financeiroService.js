// src/services/financeiroService.js
const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js

function loadSql(fileName) {
  // Mantém a pasta /queries/financeiro
  const filePath = path.join(__dirname, "..", "queries", "financeiro", fileName);
  return fs.readFileSync(filePath, "utf8");
}

// Parcelas (já existente)
const sqlParcelas = loadSql("financeiro_parcelas.sql");

// DRE por competência (NOVA QUERY)
const sqlDre = loadSql("financeiro_dre.sql");

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 * @param {string} tipo - 'TODOS' | 'PAGAR' | 'RECEBER'
 * @param {string} situacao - 'TODOS' | 'EM ABERTO' | 'EM ATRASO' | 'PAGA'
 * @param {string} campoData - 'vencimento' | 'emissao' | 'pagamento'
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  // ⚠️ A ORDEM DOS PARÂMETROS PRECISA SER:
  // 1) cod_empresa
  // 2) dataIni
  // 3) dataFim
  const params = [codEmpresa, dataIni, dataFim];
  const rows = await db.query(sqlParcelas, params);
  return rows;
}

/**
 * Busca DRE Gerencial por competência (competência = data de emissão)
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 */
async function getDre({ dataIni, dataFim, codEmpresa }) {
  // Mesma lógica de parâmetros: empresa, dataIni, dataFim
  const params = [codEmpresa, dataIni, dataFim];
  const rows = await db.query(sqlDre, params);
  return rows;
}

module.exports = {
  getParcelas,
  getDre,
};
