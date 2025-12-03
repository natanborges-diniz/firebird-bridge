// src/services/vendasService.js
const fs = require('fs');
const path = require('path');
const { runQuery } = require('../db');

// Carrega o SQL do arquivo
const resumoSql = fs.readFileSync(
  path.join(__dirname, '../../queries/vendas/resumo_empresa_vendedor.sql'),
  'utf8'
);

async function getResumoEmpresaVendedor({ dataInicio, dataFim }) {
  const params = [dataInicio, dataFim, dataInicio, dataFim];
  const rows = await runQuery(resumoSql, params);
  return rows;
}

module.exports = {
  getResumoEmpresaVendedor
};
