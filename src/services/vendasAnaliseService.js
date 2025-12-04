// src/services/vendasAnaliseService.js
const { runQuery } = require('../db');
const { loadSQL } = require('../utils/loadSQL');

const analiseFamiliaVendedorSql = loadSQL('vendas/analise_familia_vendedor.sql');

async function getAnaliseFamiliaVendedor({ dataInicio, dataFim, codEmpresa }) {
  const empresaParam = codEmpresa ?? null;

  const params = [
    dataInicio,      // 1º ?  -> DATA_INICIAL
    dataFim,         // 2º ?  -> DATA_FINAL
    empresaParam,    // 3º ?  -> para "(? IS NULL ...)"
    empresaParam     // 4º ?  -> para "= ?"
  ];

  const rows = await runQuery(analiseFamiliaVendedorSql, params);
  return rows;
}

module.exports = {
  getAnaliseFamiliaVendedor
};
