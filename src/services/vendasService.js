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
const SQL_RESUMO_DIARIO_SIMPLES = loadSql("resumo_diario_simples.sql");
const SQL_FORMAS_PAGAMENTO_RESUMO = loadSql("formas_pagamento_resumo.sql");
const SQL_FORMAS_PAGAMENTO_AUDITORIA = loadSql("formas_pagamento_auditoria.sql");
const SQL_FORMAS_PAGAMENTO_AUDITORIA_LIGHT = loadSql("formas_pagamento_auditoria_light.sql");
const SQL_ANALISE_FAMILIA_VENDEDOR = loadSql("analise_familia_vendedor.sql");
const SQL_DEBUG = loadSql("debug_resumo_empresa_vendedor.sql");

function resolvePagination(page, pageSize) {
  const parsedPage = Number(page);
  const parsedPageSize = Number(pageSize);
  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
  const safePageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? Math.floor(parsedPageSize) : 200;
  const clampedPageSize = Math.min(safePageSize, 1000);
  const rowStart = (safePage - 1) * clampedPageSize + 1;
  const rowEnd = safePage * clampedPageSize;
  return { rowStart, rowEnd };
}

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

async function getResumoDiarioSimplesPorEmpresa(
  codEmpresa,
  dataInicio,
  dataFim,
  excluirCreditos,
  options = {}
) {
  const params = [codEmpresa, dataInicio, dataFim, excluirCreditos ? 1 : 0];
  const cacheLabel = "vendas.resumo_diario_simples";
  const ttlMs = options.cacheTtlMs ?? getRangeTtlMs({ dataInicio, dataFim, baseTtlMs: DEFAULT_TTL_MS });
  return getCachedOrFetch({
    label: cacheLabel,
    params,
    ttlMs,
    enabled: options.useCache !== false,
    fetcher: () => db.runQuery(SQL_RESUMO_DIARIO_SIMPLES, params),
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

// ... (demais funções permanecem iguais)

module.exports = {
  getResumoEmpresaVendedor,
  getResumoDiarioSimples,
  getFormasPagamentoResumo,
  getFormasPagamentoAuditoria,
  getFormasPagamentoAuditoriaLight,
  getAnaliseFamiliaVendedor,
  debugResumoEmpresaVendedor,
  debugCreateIndexes,
};
