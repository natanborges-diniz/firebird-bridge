const { pingDatabase } = require('../db');
const healthFreshnessService = require('../services/healthFreshnessService');

const serviceStartMs = Date.now();
const packageJson = require('../../package.json');
const DEFAULT_HEALTH_DB_TIMEOUT_MS = 2000;
const DB_CHECK_TIMEOUT_MS = Number(process.env.HEALTH_DB_TIMEOUT_MS || DEFAULT_HEALTH_DB_TIMEOUT_MS);

function resolveVersion() {
  return process.env.APP_VERSION || process.env.npm_package_version || packageJson.version || 'unknown';
}

function nowIso() {
  return new Date().toISOString();
}

function basePayload() {
  return {
    status: 'ok',
    version: resolveVersion(),
    time: nowIso(),
    uptime_s: Math.floor((Date.now() - serviceStartMs) / 1000),
    db: {
      connected: false
    }
  };
}

async function pingDatabaseWithTimeout(timeoutMs) {
  return Promise.race([
    pingDatabase(),
    new Promise((resolve) => {
      setTimeout(() => resolve({ ok: false, error: `timeout after ${timeoutMs}ms` }), timeoutMs);
    })
  ]);
}

async function health(_req, res) {
  const payload = basePayload();

  try {
    const dbResult = await pingDatabaseWithTimeout(DB_CHECK_TIMEOUT_MS);
    payload.db.connected = Boolean(dbResult && dbResult.ok);

    if (payload.db.connected) {
      return res.status(200).json(payload);
    }

    return res.status(503).json({
      ...payload,
      status: 'degraded',
      error: (dbResult && dbResult.error) || 'firebird unavailable'
    });
  } catch (err) {
    return res.status(503).json({
      ...payload,
      status: 'degraded',
      error: err && err.message ? err.message : 'firebird unavailable'
    });
  }
}

// GET /api/v1/health/freshness
// Verifica se a copia do Firebird no servidor esta sendo atualizada
// (job diario), independente de haver movimento de negocio no dia.
async function freshness(_req, res) {
  const result = await healthFreshnessService.getDbFreshness();

  // 'indisponivel' = nao deu para verificar (ex.: Firebird < 3). Sinaliza
  // com 503 para monitores externos; frontend le data.status de qualquer forma.
  const httpStatus = result.status === 'indisponivel' ? 503 : 200;
  const ok = result.status !== 'indisponivel';

  return res.status(httpStatus).json({
    ok,
    data: result,
    error: ok ? null : (result.motivo || 'nao foi possivel verificar o frescor'),
  });
}

module.exports = { health, freshness };
