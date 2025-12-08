// src/services/empresaService.js

const db = require('../db');
const loadSQL = require('../utils/loadSQL');

async function getEmpresas() {
  const sql = loadSQL('empresas/listarEmpresas.sql');
  const result = await db.runQuery(sql);
  return result;
}

module.exports = {
  getEmpresas
};
