// src/services/financeiroService.js
const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js

function loadSql(fileName) {
  // __dirname = /app/src/services
  // ..        = /app/src
  // ..        = /app
  // queries/financeiro/fileName = /app/queries/financeiro/fileName
  const filePath = path.join(__dirname, "..", "..", "queries", "financeiro", fileName);
  return fs.readFileSync(filePath, "utf8");
}

// ⚠️ Arquivos .sql NA RAIZ DO PROJETO:
// queries/financeiro/financeiro_parcelas.sql
// queries/financeiro/financeiro_dre.sql   (vamos criar já já)
const sqlParcelas = loadSql("financeiro_parcelas.sql");
let sqlDre;
try {
  sqlDre = loadSql("financeiro_dre.sql");
} catch (e) {
  console.warn("[financeiroService] Atenção: financeiro_dre.sql ainda não existe. DRE vai falhar até criar o arquivo.");
}

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  // ORDEM DOS PARÂMETROS PRECISA BATER COM A QUERY:
  // where fl.cod_empresa = ?
  //   and fp.datavencimento between ? and ?
  const params = [codEmpresa, dataIni, dataFim];
  const rows = await db.query(sqlParcelas, params);
  return rows;
}

/**
 * DRE Gerencial (por competência = data de emissão)
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 */
async function getDre({ dataIni, dataFim, codEmpresa }) {
  if (!sqlDre) {
    throw new Error("Arquivo financeiro_dre.sql não encontrado em queries/financeiro");
  }

  // Mesma lógica: respeitar ordem dos parâmetros da query DRE
  const params = [codEmpresa, dataIni, dataFim];
  const rows = await db.query(sqlDre, params);
  return rows;
}

module.exports = {
  getParcelas,
  getDre,
};
