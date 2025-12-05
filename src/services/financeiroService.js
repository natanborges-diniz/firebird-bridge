// src/services/financeiroService.js
const db = require("../db"); // src/db/index.js
const { loadSQL } = require("../utils/loadSQL");

// 👉 Aqui usamos o mesmo padrão dos outros módulos:
//    /app/queries/financeiro/financeiro_parcelas.sql
const sqlParcelas = loadSQL("financeiro/financeiro_parcelas.sql");

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  const params = [dataIni, dataFim, codEmpresa];

  try {
    const rows = await db.query(sqlParcelas, params);
    return rows;
  } catch (err) {
    console.error("Erro ao executar sqlParcelas:", err);
    throw err; // deixa o controller devolver 500
  }
}

module.exports = {
  getParcelas,
};
