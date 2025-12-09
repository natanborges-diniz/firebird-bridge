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

// Arquivos .sql em queries/financeiro/
const sqlParcelas = loadSql("financeiro_parcelas.sql");
let sqlDre;
try {
  sqlDre = loadSql("financeiro_dre.sql");
} catch (e) {
  console.warn(
    "[financeiroService] Atenção: financeiro_dre.sql ainda não existe. " +
      "DRE vai falhar até criar o arquivo."
  );
}

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {Object} params
 * @param {string} params.dataIni    - 'YYYY-MM-DD'
 * @param {string} params.dataFim    - 'YYYY-MM-DD'
 * @param {number|string} params.codEmpresa
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  // ORDEM DOS PARÂMETROS PRECISA BATER COM A QUERY:
  // where
  //   fl.cod_empresa not in (3, 5, 7, 8, 11, 12)
  //   and (
  //     fl.cod_empresa = cast(? as integer)
  //     or (
  //       cast(? as integer) in (13, 18)
  //       and fl.cod_empresa in (13, 18)
  //     )
  //   )
  //   and fp.datavencimento between cast(? as date) and cast(? as date)
  const params = [codEmpresa, codEmpresa, dataIni, dataFim];

  const rows = await db.query(sqlParcelas, params);
  return rows;
}

/**
 * DRE Gerencial (por competência = data de emissão)
 * @param {Object} params
 * @param {string} params.dataIni    - 'YYYY-MM-DD'
 * @param {string} params.dataFim    - 'YYYY-MM-DD'
 * @param {number|string} params.codEmpresa
 */
async function getDre({ dataIni, dataFim, codEmpresa }) {
  if (!sqlDre) {
    throw new Error("Arquivo financeiro_dre.sql não encontrado em queries/financeiro");
  }

  // Aqui assumimos que o DRE ainda usa 3 parâmetros: [codEmpresa, dataIni, dataFim]
  // Ajusta se o SQL do DRE tiver outra assinatura.
  const params = [codEmpresa, dataIni, dataFim];
  const rows = await db.query(sqlDre, params);
  return rows;
}

module.exports = {
  getParcelas,
  getDre
};
