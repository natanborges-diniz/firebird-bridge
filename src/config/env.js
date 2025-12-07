// src/config/env.js
require('dotenv').config();

const requiredKeys = ['FIREBIRD_HOST', 'FIREBIRD_DATABASE'];
const connectStringKeys = [
  // aceita conexão direta já formatada ex.: 201.20.35.230/3050:/caminho/db.FDB
  'FIREBIRD_CONNECT_STRING',
  'FIREBIRD_URL',
  'FIREBIRD_CONNECTION_STRING'
];

const legacyKeyAliases = {
  FB_HOST: 'FIREBIRD_HOST',
  FB_DATABASE: 'FIREBIRD_DATABASE',
  FB_PORT: 'FIREBIRD_PORT',
  FB_CONNECT_STRING: 'FIREBIRD_CONNECT_STRING',
  FB_URL: 'FIREBIRD_URL',
  FB_CONNECTION_STRING: 'FIREBIRD_CONNECTION_STRING'
};

function buildUppercaseEnvMap() {
  const env = Object.entries(process.env).reduce((acc, [key, value]) => {
    acc[key.toUpperCase()] = value;
    return acc;
  }, {});

  Object.entries(legacyKeyAliases).forEach(([legacyKey, canonicalKey]) => {
    if (!env[canonicalKey] && env[legacyKey]) {
      env[canonicalKey] = env[legacyKey];
    }
  });

  return env;
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
