// src/services/vendasService.js
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { parseEmpresasParam } = require("../utils/empresaHelper");
const { DEFAULT_TTL_MS, getCachedOrFetch, getRangeTtlMs } = require("../utils/queryCache");
const sqlCreateIndexes = loadSql("debug_create_indexes.sql");
const LOG_QUERY_TIME = process.env.LOG_QUERY_TIME === "true";

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

async function getFormasPagamentoResumoPorEmpresa(
  codEmpresa,
  dataInicio,
  dataFim,
  excluirCreditos,
  incluirDevolucoes,
  options = {}
) {
  const params = [
    codEmpresa,
    codEmpresa,
    dataInicio,
    dataFim,
    dataInicio,
    dataFim,
    dataInicio,
    dataFim,
    excluirCreditos ? 1 : 0,
    incluirDevolucoes ? 1 : 0,
  ];
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
  const startedAt = Date.now();
  const results = await Promise.allSettled(
    empresas.map((cod) =>
      getResumoEmpresaVendedorPorEmpresa(cod, dataInicio, dataFim, excluirCreditos, {
        useCache,
        cacheTtlMs,
      })
    )
  );
  if (LOG_QUERY_TIME) {
    console.log(
      `[VENDAS] resumo-empresa-vendedor empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`
    );
  }
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value ?? [];
    }
    console.error(
      `[VENDAS] resumo-empresa-vendedor empresa ${empresas[index]}:`,
      result.reason?.message || result.reason
    );
    return [];
  });
}

async function getFormasPagamentoResumo({
  empresa,
  dataInicio,
  dataFim,
  excluirCreditos,
  incluirDevolucoes,
  useCache,
  cacheTtlMs,
}) {
  const empresas = parseEmpresasParam(empresa);
  const startedAt = Date.now();
  const results = await Promise.allSettled(
    empresas.map((cod) =>
      getFormasPagamentoResumoPorEmpresa(
        cod,
        dataInicio,
        dataFim,
        excluirCreditos,
        incluirDevolucoes,
        {
          useCache,
          cacheTtlMs,
        }
      )
    )
  );
  if (LOG_QUERY_TIME) {
    console.log(
      `[VENDAS] resumo-formas-pagamento empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`
    );
  }
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value ?? [];
    }
    console.error(
      `[VENDAS] resumo-formas-pagamento empresa ${empresas[index]}:`,
      result.reason?.message || result.reason
    );
    return [];
  });
}

async function getAnaliseFamiliaVendedor({ empresa, dataInicio, dataFim, useCache, cacheTtlMs }) {
  const empresas = parseEmpresasParam(empresa);
  const startedAt = Date.now();
  const results = await Promise.allSettled(
    empresas.map((cod) =>
      getAnaliseFamiliaVendedorPorEmpresa(cod, dataInicio, dataFim, {
        useCache,
        cacheTtlMs,
      })
    )
  );
  if (LOG_QUERY_TIME) {
    console.log(
      `[VENDAS] analise-familia-vendedor empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`
    );
  }
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value ?? [];
    }
    console.error(
      `[VENDAS] analise-familia-vendedor empresa ${empresas[index]}:`,
      result.reason?.message || result.reason
    );
    return [];
  });
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
