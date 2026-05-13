// src/services/vendasService.js
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { parseEmpresasParam } = require("../utils/empresaHelper");
const {
  DEFAULT_TTL_MS,
  getCachedOrFetch,
  getCachedEntry,
  getRangeTtlMs,
  setCachedValue,
} = require("../utils/queryCache");
const sqlCreateIndexes = loadSql("debug_create_indexes.sql");
const LOG_QUERY_TIME = process.env.LOG_QUERY_TIME === "true";
const FORMAS_PAGAMENTO_QUERY_TIMEOUT_MS = Number(process.env.FORMAS_PAGAMENTO_QUERY_TIMEOUT_MS || 45000);
const FORMAS_PAGAMENTO_STALE_MAX_AGE_MS = Number(process.env.FORMAS_PAGAMENTO_STALE_MAX_AGE_MS || 30 * 60 * 1000);
const FORMAS_PAGAMENTO_ALL_EMPRESAS_STALE_MAX_AGE_MS = Number(
  process.env.FORMAS_PAGAMENTO_ALL_EMPRESAS_STALE_MAX_AGE_MS || FORMAS_PAGAMENTO_STALE_MAX_AGE_MS
);

function runWithTimeout(promise, timeoutMs, context) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const err = new Error(`Timeout after ${timeoutMs}ms (${context})`);
      err.code = "QUERY_TIMEOUT";
      reject(err);
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

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
const SQL_ANALISE_SKU = loadSql("analise_sku.sql");
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
  const params = [
    codEmpresa,
    codEmpresa,
    dataInicio,
    dataFim,
    excluirCreditos ? 1 : 0,
    dataInicio,
    dataFim,
    codEmpresa,
    codEmpresa,
    dataInicio,
    dataFim,
    codEmpresa,
    codEmpresa,
  ];
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

  const fetchLive = () =>
    runWithTimeout(
      db.runQuery(SQL_FORMAS_PAGAMENTO_RESUMO, params),
      options.queryTimeoutMs ?? FORMAS_PAGAMENTO_QUERY_TIMEOUT_MS,
      `vendas.formas_pagamento_resumo.empresa_${codEmpresa}`
    );

  if (options.useCache !== false) {
    return getCachedOrFetch({
      label: cacheLabel,
      params,
      ttlMs,
      enabled: true,
      fetcher: fetchLive,
    });
  }

  try {
    const liveResult = await fetchLive();
    setCachedValue({ label: cacheLabel, params, value: liveResult, ttlMs });
    return liveResult;
  } catch (err) {
    if (options.allowStaleOnError) {
      const staleEntry = getCachedEntry({ label: cacheLabel, params, allowExpired: true });
      if (staleEntry) {
        const staleAgeMs = Date.now() - (staleEntry.createdAt || 0);
        const maxAgeMs = options.staleMaxAgeMs ?? FORMAS_PAGAMENTO_STALE_MAX_AGE_MS;
        if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || staleAgeMs <= maxAgeMs) {
          console.warn(
            `[VENDAS] resumo-formas-pagamento usando cache stale empresa=${codEmpresa} age_ms=${staleAgeMs} reason=${err.message}`
          );
          return staleEntry.value;
        }
      }
    }

    throw err;
  }
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

async function getAnaliseSkuPorEmpresa(codEmpresa, dataInicio, dataFim, options = {}) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim];
  const cacheLabel = "vendas.analise_sku";
  const ttlMs = options.cacheTtlMs ?? getRangeTtlMs({ dataInicio, dataFim, baseTtlMs: DEFAULT_TTL_MS });
  return getCachedOrFetch({
    label: cacheLabel,
    params,
    ttlMs,
    enabled: options.useCache !== false,
    fetcher: () => db.runQuery(SQL_ANALISE_SKU, params),
  });
}

async function debugResumoEmpresaVendedor(params) {
  return db.runQuery(SQL_DEBUG, params);
}

async function debugCreateIndexes() {
  return db.query(sqlCreateIndexes);
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
  try {
    const empresas = parseEmpresasParam(empresa);
    const startedAt = Date.now();
    const shouldAllowStaleOnError = useCache === false;
    const allEmpresasCacheLabel = "vendas.formas_pagamento_resumo.all_empresas";
    const allEmpresasCacheParams = [
      empresas.join(","),
      dataInicio,
      dataFim,
      excluirCreditos ? 1 : 0,
      incluirDevolucoes ? 1 : 0,
    ];
    const ttlMs = cacheTtlMs ?? getRangeTtlMs({ dataInicio, dataFim, baseTtlMs: DEFAULT_TTL_MS });

    if (shouldAllowStaleOnError && empresas.length > 1) {
      const staleAllEmpresasEntry = getCachedEntry({
        label: allEmpresasCacheLabel,
        params: allEmpresasCacheParams,
        allowExpired: true,
      });

      if (staleAllEmpresasEntry) {
        const staleAgeMs = Date.now() - (staleAllEmpresasEntry.createdAt || 0);
        if (
          !Number.isFinite(FORMAS_PAGAMENTO_ALL_EMPRESAS_STALE_MAX_AGE_MS) ||
          FORMAS_PAGAMENTO_ALL_EMPRESAS_STALE_MAX_AGE_MS <= 0 ||
          staleAgeMs <= FORMAS_PAGAMENTO_ALL_EMPRESAS_STALE_MAX_AGE_MS
        ) {
          console.warn(
            `[VENDAS] resumo-formas-pagamento retornando cache stale all_empresas sem consultar Firebird age_ms=${staleAgeMs}`
          );
          return staleAllEmpresasEntry.value;
        }
      }
    }

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
            allowStaleOnError: shouldAllowStaleOnError,
          }
        )
      )
    );

    if (LOG_QUERY_TIME) {
      console.log(
        `[VENDAS] resumo-formas-pagamento empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`
      );
    }

    let failureCount = 0;
    const flattened = results.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        return result.value ?? [];
      }

      failureCount += 1;
      console.error(
        `[VENDAS] resumo-formas-pagamento empresa ${empresas[index]}:`,
        result.reason?.message || result.reason
      );
      return [];
    });

    if (failureCount === empresas.length) {
      const staleAllEmpresasEntry = getCachedEntry({
        label: allEmpresasCacheLabel,
        params: allEmpresasCacheParams,
        allowExpired: true,
      });

      if (staleAllEmpresasEntry) {
        const staleAgeMs = Date.now() - (staleAllEmpresasEntry.createdAt || 0);
        if (
          !Number.isFinite(FORMAS_PAGAMENTO_ALL_EMPRESAS_STALE_MAX_AGE_MS) ||
          FORMAS_PAGAMENTO_ALL_EMPRESAS_STALE_MAX_AGE_MS <= 0 ||
          staleAgeMs <= FORMAS_PAGAMENTO_ALL_EMPRESAS_STALE_MAX_AGE_MS
        ) {
          console.warn(
            `[VENDAS] resumo-formas-pagamento usando cache stale all_empresas age_ms=${staleAgeMs} timeout_ms=${FORMAS_PAGAMENTO_QUERY_TIMEOUT_MS}`
          );
          return staleAllEmpresasEntry.value;
        }
      }

      const error = new Error(
        "Não foi possível consultar resumo de formas de pagamento no Firebird (todas as empresas falharam)."
      );
      error.code = "VENDAS_FORMAS_PAGAMENTO_UNAVAILABLE";
      throw error;
    }

    setCachedValue({
      label: allEmpresasCacheLabel,
      params: allEmpresasCacheParams,
      value: flattened,
      ttlMs,
    });

    return flattened;
  } catch (err) {
    if (err?.code) {
      throw err;
    }

    const wrappedError = new Error(
      "Não foi possível consultar resumo de formas de pagamento no Firebird (falha inesperada)."
    );
    wrappedError.code = "VENDAS_FORMAS_PAGAMENTO_UNAVAILABLE";
    wrappedError.cause = err;
    throw wrappedError;
  }
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

async function getAnaliseSku({ empresa, dataInicio, dataFim, useCache, cacheTtlMs }) {
  const empresas = parseEmpresasParam(empresa);
  const startedAt = Date.now();
  const results = await Promise.allSettled(
    empresas.map((cod) =>
      getAnaliseSkuPorEmpresa(cod, dataInicio, dataFim, {
        useCache,
        cacheTtlMs,
      })
    )
  );
  if (LOG_QUERY_TIME) {
    console.log(`[VENDAS] analise-sku empresas=${empresas.join(",")} duration_ms=${Date.now() - startedAt}`);
  }
  const rows = results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value ?? [];
    }
    console.error(
      `[VENDAS] analise-sku empresa ${empresas[index]}:`,
      result.reason?.message || result.reason
    );
    return [];
  });

  if (results.length > 0 && results.every((result) => result.status === "rejected")) {
    throw results[0].reason;
  }

  return rows;
}
module.exports = {
  getResumoEmpresaVendedor,
  getResumoDiarioSimples,
  getFormasPagamentoResumo,
  getFormasPagamentoAuditoria,
  getFormasPagamentoAuditoriaLight,
  getAnaliseFamiliaVendedor,
  getAnaliseSku,
  debugResumoEmpresaVendedor,
  debugCreateIndexes,
};
