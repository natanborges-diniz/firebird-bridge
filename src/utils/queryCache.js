// src/utils/queryCache.js
const DEFAULT_TTL_MS = 2 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

class QueryCache {
  constructor() {
    this.store = new Map();
  }

  buildKey(label, params) {
    const serializedParams = JSON.stringify(params ?? []);
    return `${label}:${serializedParams}`;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    if (this.store.size >= MAX_CACHE_ENTRIES) {
      this.evictExpired();
      if (this.store.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey) this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
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

module.exports = {
  DEFAULT_TTL_MS,
  getCachedOrFetch,
};
