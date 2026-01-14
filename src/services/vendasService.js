// src/services/vendasService.js
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { parseEmpresasParam } = require("../utils/empresaHelper");
const { DEFAULT_TTL_MS, getCachedOrFetch, getRangeTtlMs } = require("../utils/queryCache");
const sqlCreateIndexes = loadSql("debug_create_indexes.sql");

function loadSql(filename) {
  const filePath = path.join(__dirname, "..", "..", "queries", "vendas", filename);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`[VENDAS] SQL FILE NOT FOUND: ${filePath}`);
    throw err;
  }
}

const SQL_RESUMO_EMPRESA_VENDEDOR = loadSql("resumo_empresa_vendedor.sql");
const SQL_FORMAS_PAGAMENTO_RESUMO = loadSql("formas_pagamento_resumo.sql");
const SQL_ANALISE_FAMILIA_VENDEDOR = loadSql("analise_familia_vendedor.sql");
const SQL_DEBUG = loadSql("debug_resumo_empresa_vendedor.sql");

// --------- QUERIES POR EMPRESA ---------
async function getResumoEmpresaVendedorPorEmpresa(
  codEmpresa,
  dataInicio,
  dataFim,
  excluirCreditos,
  options = {}
) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim, excluirCreditos ? 1 : 0];
  const cacheLabel = "vendas.resumo_empresa_vendedor";
  const ttlMs = options.cacheTtlMs ?? getRangeTtlMs({ dataInicio, dataFim, baseTtlMs: DEFAULT_TTL_MS });
  return getCachedOrFetch({
    label: cacheLabel,
    params,
    ttlMs,
    enabled: options.useCache !== false,
    fetcher: () => db.runQuery(SQL_RESUMO_EMPRESA_VENDEDOR, params),
  });
}

async function getFormasPagamentoResumoPorEmpresa(codEmpresa, dataInicio, dataFim, options = {}) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim, dataInicio, dataFim, dataInicio, dataFim];
  const cacheLabel = "vendas.formas_pagamento_resumo";
  const ttlMs = options.cacheTtlMs ?? getRangeTtlMs({ dataInicio, dataFim, baseTtlMs: DEFAULT_TTL_MS });
  return getCachedOrFetch({
    label: cacheLabel,
    params,
    ttlMs,
    enabled: options.useCache !== false,
    fetcher: () => db.runQuery(SQL_FORMAS_PAGAMENTO_RESUMO, params),
  });
}

async function getAnaliseFamiliaVendedorPorEmpresa(codEmpresa, dataInicio, dataFim, options = {}) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim];
  const cacheLabel = "vendas.analise_familia_vendedor";
  const ttlMs = options.cacheTtlMs ?? getRangeTtlMs({ dataInicio, dataFim, baseTtlMs: DEFAULT_TTL_MS });
  return getCachedOrFetch({
    label: cacheLabel,
    params,
    ttlMs,
    enabled: options.useCache !== false,
    fetcher: () => db.runQuery(SQL_ANALISE_FAMILIA_VENDEDOR, params),
  });
}

async function debugResumoEmpresaVendedor(params) {
  return db.runQuery(SQL_DEBUG, params);
}

// --------- APIS PRINCIPAIS ---------
async function getResumoEmpresaVendedor({
  empresa,
  dataInicio,
  dataFim,
  excluirCreditos,
  useCache,
  cacheTtlMs,
}) {
  const empresas = parseEmpresasParam(empresa);
  let allRows = [];

  for (const cod of empresas) {
    try {
      const rows = await getResumoEmpresaVendedorPorEmpresa(cod, dataInicio, dataFim, excluirCreditos, {
        useCache,
        cacheTtlMs,
      });
      if (rows && rows.length) allRows = allRows.concat(rows);
    } catch (err) {
      console.error(`[VENDAS] resumo-empresa-vendedor empresa ${cod}:`, err.message || err);
    }
  }
  return allRows;
}

async function getFormasPagamentoResumo({ empresa, dataInicio, dataFim, useCache, cacheTtlMs }) {
  const empresas = parseEmpresasParam(empresa);
  let allRows = [];

  for (const cod of empresas) {
    try {
      const rows = await getFormasPagamentoResumoPorEmpresa(cod, dataInicio, dataFim, {
        useCache,
        cacheTtlMs,
      });
      if (rows && rows.length) allRows = allRows.concat(rows);
    } catch (err) {
      console.error(`[VENDAS] resumo-formas-pagamento empresa ${cod}:`, err.message || err);
    }
  }
  return allRows;
}

async function getAnaliseFamiliaVendedor({ empresa, dataInicio, dataFim, useCache, cacheTtlMs }) {
  const empresas = parseEmpresasParam(empresa);
  let allRows = [];

  for (const cod of empresas) {
    try {
      const rows = await getAnaliseFamiliaVendedorPorEmpresa(cod, dataInicio, dataFim, {
        useCache,
        cacheTtlMs,
      });
      if (rows && rows.length) allRows = allRows.concat(rows);
    } catch (err) {
      console.error(`[VENDAS] analise-familia-vendedor empresa ${cod}:`, err.message || err);
    }
  }
  return allRows;
}
async function debugCreateIndexes() {
  return db.query(sqlCreateIndexes);
}

module.exports = {
  getResumoEmpresaVendedor,
  getFormasPagamentoResumo,
  getAnaliseFamiliaVendedor,
  debugResumoEmpresaVendedor,
  debugCreateIndexes,
};
