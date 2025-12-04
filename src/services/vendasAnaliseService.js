// src/services/vendasAnaliseService.js
const { runQuery } = require('../db');
const { loadSQL } = require('../utils/loadSQL');

const analiseFamiliaVendedorSql = loadSQL('vendas/analise_familia_vendedor.sql');

async function getAnaliseFamiliaVendedor({ dataInicio, dataFim, codEmpresa }) {
  // Ordem dos parâmetros segue a ordem dos :param no SQL
  const params = [
    dataInicio,          // :DATA_INICIAL
    dataFim,             // :DATA_FINAL
    codEmpresa ?? null   // :COD_EMPRESA
  ];

  const rows = await runQuery(analiseFamiliaVendedorSql, params);
  return rows;
}

module.exports = {
  getAnaliseFamiliaVendedor
};
