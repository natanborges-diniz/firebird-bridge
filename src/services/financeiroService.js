// src/services/financeiroService.js
// Serviço de FINANCEIRO no BRIDGE (Node.js + Firebird)

// CommonJS, pois o projeto do bridge usa require/module.exports

const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js

/**
 * Carrega um arquivo .sql da pasta queries/financeiro
 * Estrutura esperada:
 *   /app
 *     /src
 *       /services/financeiroService.js  (__dirname aqui)
 *     /queries
 *       /financeiro
 *         financeiro_parcelas.sql
 *         financeiro_dre.sql
 */
function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "financeiro", fileName);
  return fs.readFileSync(filePath, "utf8");
}

// SQLs externos
const sqlParcelas = loadSql("financeiro_parcelas.sql");

let sqlDre;
try {
  sqlDre = loadSql("financeiro_dre.sql");
} catch (e) {
  console.warn(
    "[financeiroService] Atenção: queries/financeiro/financeiro_dre.sql não encontrado. " +
      "O endpoint de DRE vai falhar até você criar esse arquivo."
  );
}

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * Parâmetros vêm do controller já validados:
 *   { empresa, dataInicio, dataFim }
 *
 * A query financeiro_parcelas.sql deve esperar:
 *   where fl.cod_empresa = ?
 *     and fp.datavencimento between ? and ?
 */
async function getParcelas({ empresa, dataInicio, dataFim }) {
  const params = [empresa, dataInicio, dataFim];
  const rows = await db.query(sqlParcelas, params);
  return rows;
}

/**
 * DRE Gerencial (por competência = data de emissão ou competência da query)
 * Parâmetros:
 *   { empresa, dataInicio, dataFim }
 *
 * A query financeiro_dre.sql deve usar os mesmos três parâmetros nessa ordem.
 */
async function getDre({ empresa, dataInicio, dataFim }) {
  if (!sqlDre) {
    throw new Error(
      "Arquivo queries/financeiro/financeiro_dre.sql não encontrado. " +
        "Crie o arquivo para habilitar o endpoint de DRE."
    );
  }

  const params = [empresa, dataInicio, dataFim];
  const rows = await db.query(sqlDre, params);
  return rows;
}

module.exports = {
  getParcelas,
  getDre,
};
