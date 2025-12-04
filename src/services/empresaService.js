// src/services/empresaService.js
const { runQuery } = require('../db');
const { loadSQL } = require('../utils/loadSQL');

const listarEmpresasSql = loadSQL('empresas/listar_empresas.sql');

async function getEmpresas() {
  const rows = await runQuery(listarEmpresasSql, []);
  return rows;
}

module.exports = {
  getEmpresas
};
