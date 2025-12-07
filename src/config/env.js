// src/config/env.js
require('dotenv').config();

const requiredKeys = ['FIREBIRD_HOST', 'FIREBIRD_DATABASE'];
const connectStringKeys = [
  // aceita conexão direta já formatada ex.: 201.20.35.230/3050:/caminho/db.FDB
  'FIREBIRD_CONNECT_STRING',
  'FIREBIRD_URL',
  'FIREBIRD_CONNECTION_STRING'
];

function buildUppercaseEnvMap() {
  return Object.entries(process.env).reduce((acc, [key, value]) => {
    acc[key.toUpperCase()] = value;
    return acc;
  }, {});
}

function getFirebirdConnectString() {
  const env = buildUppercaseEnvMap();

  const directKey = connectStringKeys.find((key) => env[key.toUpperCase()]);
  if (directKey) return env[directKey.toUpperCase()];

  const missing = requiredKeys.filter((key) => !env[key]);
  if (missing.length) {
    const extras = `Defina ${connectStringKeys[0]} (ou sinônimos: ${connectStringKeys
      .slice(1)
      .join(', ')}) ou todas as variáveis obrigatórias (FIREBIRD_HOST/FIREBIRD_DATABASE).`;
    throw new Error(`Variáveis obrigatórias faltando: ${missing.join(', ')}. ${extras}`);
  }

  const hostWithPort = env.FIREBIRD_PORT ? `${env.FIREBIRD_HOST}/${env.FIREBIRD_PORT}` : env.FIREBIRD_HOST;

  return `${hostWithPort}:${env.FIREBIRD_DATABASE}`;
}

function resolveGetFirebirdConnectString(moduleLike) {
  const candidates = [moduleLike, moduleLike?.default];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'function') return candidate;
    if (typeof candidate.getFirebirdConnectString === 'function') return candidate.getFirebirdConnectString;
  }

  return null;
}

module.exports = {
  getFirebirdConnectString,
  resolveGetFirebirdConnectString,
  requiredKeys,
  connectStringKeys,
  buildUppercaseEnvMap
};

module.exports.default = module.exports;
