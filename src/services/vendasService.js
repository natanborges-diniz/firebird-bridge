// src/services/vendasService.js
const { runQuery } = require('../db');
const { loadSQL } = require('../utils/loadSQL');

// Carrega o SQL da pasta queries
const resumoSql = loadSQL('vendas/resumo_empresa_vendedor.sql');

async function getResumoEmpresaVendedor({ dataInicio, dataFim }) {
  const params = [dataInicio, dataFim, dataInicio, dataFim];
  const rows = await runQuery(resumoSql, params);
  return rows;
}

module.exports = {
  getResumoEmpresaVendedor
};
