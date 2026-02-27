// src/utils/queryCache.js
const DEFAULT_TTL_MS = 2 * 60 * 1000;
const MEDIUM_TTL_MS = 5 * 60 * 1000;
const LONG_TTL_MS = 10 * 60 * 1000;
const MAX_TTL_MS = 20 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

class QueryCache {
  constructor() {
    this.store = new Map();
  }

  buildKey(label, params) {
    const serializedParams = JSON.stringify(params ?? []);
    return `${label}:${serializedParams}`;
  }

  getEntry(key, { allowExpired = false } = {}) {
    const entry = this.store.get(key);
    if (!entry) return null;

    const isExpired = entry.expiresAt <= Date.now();
    if (isExpired && !allowExpired) {
      this.store.delete(key);
      return null;
    }

    return entry;
  }

  get(key, options = {}) {
    const entry = this.getEntry(key, options);
    return entry ? entry.value : null;
  }

  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    if (this.store.size >= MAX_CACHE_ENTRIES) {
      this.evictExpired();
      if (this.store.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey) this.store.delete(oldestKey);
      }
    }
    const now = Date.now();
    this.store.set(key, {
      value,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
  }

  evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

const queryCache = new QueryCache();

function getCachedOrFetch({ label, params, ttlMs, enabled, fetcher }) {
  if (!enabled) {
    return fetcher();
  }

  const key = queryCache.buildKey(label, params);
  const cached = queryCache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }

  return fetcher().then((result) => {
    queryCache.set(key, result, ttlMs);
    return result;
  });
}

function getCachedValue({ label, params, allowExpired = false }) {
  const key = queryCache.buildKey(label, params);
  return queryCache.get(key, { allowExpired });
}

function getCachedEntry({ label, params, allowExpired = false }) {
  const key = queryCache.buildKey(label, params);
  return queryCache.getEntry(key, { allowExpired });
}

function setCachedValue({ label, params, value, ttlMs = DEFAULT_TTL_MS }) {
  const key = queryCache.buildKey(label, params);
  queryCache.set(key, value, ttlMs);
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getRangeTtlMs({ dataInicio, dataFim, baseTtlMs = DEFAULT_TTL_MS }) {
  const start = normalizeDate(dataInicio);
  const end = normalizeDate(dataFim);

  if (!start || !end) return baseTtlMs;

  const diffMs = Math.abs(end.getTime() - start.getTime());
  const diffDays = diffMs / (24 * 60 * 60 * 1000);

  if (diffDays >= 180) return MAX_TTL_MS;
  if (diffDays >= 90) return LONG_TTL_MS;
  if (diffDays >= 30) return MEDIUM_TTL_MS;

  return baseTtlMs;
}

module.exports = {
  DEFAULT_TTL_MS,
  MEDIUM_TTL_MS,
  LONG_TTL_MS,
  MAX_TTL_MS,
  getCachedOrFetch,
  getCachedValue,
  getCachedEntry,
  setCachedValue,
  getRangeTtlMs,
};
