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

function mapResumoDiarioSimplesRow(row) {
  return {
    DATA_VENDA: row.data_venda ?? null,
    COD_EMPRESA: row.cod_empresa ?? null,
    VENDEDOR: row.vendedor ?? null,
    FORMAPAGAMENTO: row.formapagamento ?? null,
    QTD_VENDAS: row.qtd_vendas ?? null,
    TOTAL_BRUTO: row.total_bruto ?? null,
    TOTAL_VENDIDO: row.total_vendido ?? null,
    TOTAL_DESCONTO: row.total_desconto ?? null,
    TOTAL_PAGO_FORMA: row.total_pago_forma ?? null,
  };
}

function mapResumoDiarioSimplesRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapResumoDiarioSimplesRow);
}

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
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim, excluirCreditos ? 1 : 0];
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

async function getFormasPagamentoAuditoriaPorEmpresa(
  codEmpresa,
  dataInicio,
  dataFim,
  excluirCreditos,
  pagination,
  options = {}
) {
  const { rowStart, rowEnd } = pagination;
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim, excluirCreditos ? 1 : 0, rowStart, rowEnd];
  const cacheLabel = "vendas.formas_pagamento_auditoria";
  const ttlMs = options.cacheTtlMs ?? getRangeTtlMs({ dataInicio, dataFim, baseTtlMs: DEFAULT_TTL_MS });
  return getCachedOrFetch({
    label: cacheLabel,
    params,
    ttlMs,
    enabled: options.useCache !== false,
    fetcher: () => db.runQuery(SQL_FORMAS_PAGAMENTO_AUDITORIA, params),
  });
}

async function getFormasPagamentoAuditoriaLightPorEmpresa(
  codEmpresa,
  dataInicio,
  dataFim,
  excluirCreditos,
  pagination,
  options = {}
) {
  const { rowStart, rowEnd } = pagination;
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim, excluirCreditos ? 1 : 0, rowStart, rowEnd];
  const cacheLabel = "vendas.formas_pagamento_auditoria_light";
  const ttlMs = options.cacheTtlMs ?? getRangeTtlMs({ dataInicio, dataFim, baseTtlMs: DEFAULT_TTL_MS });
  return getCachedOrFetch({
    label: cacheLabel,
    params,
    ttlMs,
    enabled: options.useCache !== false,
    fetcher: () => db.runQuery(SQL_FORMAS_PAGAMENTO_AUDITORIA_LIGHT, params),
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

async function getResumoDiarioSimples({
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
      getResumoDiarioSimplesPorEmpresa(cod, dataInicio, dataFim, excluirCreditos, {
        useCache,
        cacheTtlMs,
      })
    )
  );
  if (LOG_QUERY_TIME) {
    console.log(
      `[VENDAS] resumo-diario-simples empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`
    );
  }
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return mapResumoDiarioSimplesRows(result.value ?? []);
    }
    console.error(
      `[VENDAS] resumo-diario-simples empresa ${empresas[index]}:`,
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

async function getFormasPagamentoAuditoria({
  empresa,
  dataInicio,
  dataFim,
  excluirCreditos,
  page,
  pageSize,
  useCache,
  cacheTtlMs,
}) {
  const empresas = parseEmpresasParam(empresa);
  const pagination = resolvePagination(page, pageSize);
  const startedAt = Date.now();
  const results = await Promise.allSettled(
    empresas.map((cod) =>
      getFormasPagamentoAuditoriaPorEmpresa(cod, dataInicio, dataFim, excluirCreditos, pagination, {
        useCache,
        cacheTtlMs,
      })
    )
  );
  if (LOG_QUERY_TIME) {
    console.log(
      `[VENDAS] auditoria-formas-pagamento empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`
    );
  }
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value ?? [];
    }
    console.error(
      `[VENDAS] auditoria-formas-pagamento empresa ${empresas[index]}:`,
      result.reason?.message || result.reason
    );
    return [];
  });
}

async function getFormasPagamentoAuditoriaLight({
  empresa,
  dataInicio,
  dataFim,
  excluirCreditos,
  page,
  pageSize,
  useCache,
  cacheTtlMs,
}) {
  const empresas = parseEmpresasParam(empresa);
  const pagination = resolvePagination(page, pageSize);
  const startedAt = Date.now();
  const results = await Promise.allSettled(
    empresas.map((cod) =>
      getFormasPagamentoAuditoriaLightPorEmpresa(cod, dataInicio, dataFim, excluirCreditos, pagination, {
        useCache,
        cacheTtlMs,
      })
    )
  );
  if (LOG_QUERY_TIME) {
    console.log(
      `[VENDAS] auditoria-formas-pagamento-light empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`
    );
  }
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value ?? [];
    }
    console.error(
      `[VENDAS] auditoria-formas-pagamento-light empresa ${empresas[index]}:`,
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
  getResumoDiarioSimples,
  getFormasPagamentoResumo,
  getFormasPagamentoAuditoria,
  getFormasPagamentoAuditoriaLight,
  getAnaliseFamiliaVendedor,
  debugResumoEmpresaVendedor,
  debugCreateIndexes,
};
