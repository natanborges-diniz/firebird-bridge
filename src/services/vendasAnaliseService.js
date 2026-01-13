// src/services/vendasAnaliseService.js
const { runQuery } = require('../db');
const { DEFAULT_TTL_MS, getCachedOrFetch, getRangeTtlMs } = require('../utils/queryCache');
const { loadSQL } = require('../utils/loadSQL');

const analiseFamiliaVendedorSql = loadSQL('vendas/analise_familia_vendedor.sql');

async function getAnaliseFamiliaVendedor({ dataInicio, dataFim, codEmpresa, useCache, cacheTtlMs }) {
  const empresaParam = codEmpresa ?? null;

  const params = [
    dataInicio,      // 1º ?  -> DATA_INICIAL
    dataFim,         // 2º ?  -> DATA_FINAL
    empresaParam,    // 3º ?  -> para "(? IS NULL ...)"
    empresaParam     // 4º ?  -> para "= ?"
  ];

  const cacheLabel = 'vendas_analise.familia_vendedor';
  const ttlMs = cacheTtlMs ?? getRangeTtlMs({ dataInicio, dataFim, baseTtlMs: DEFAULT_TTL_MS });

  return getCachedOrFetch({
    label: cacheLabel,
    params,
    ttlMs,
    enabled: useCache !== false,
    fetcher: () => runQuery(analiseFamiliaVendedorSql, params),
  });
}

module.exports = {
  getAnaliseFamiliaVendedor
};
