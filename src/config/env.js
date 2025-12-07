// src/config/env.js
require('dotenv').config();

/**
 * Chaves obrigatórias "novas"
 */
const requiredKeys = ['FIREBIRD_HOST', 'FIREBIRD_DATABASE'];

/**
 * Chaves legadas que mapeiam para as novas
 * (caso você ainda use FB_HOST / FB_DATABASE, etc.)
 */
const legacyKeyAliases = {
  FB_HOST: 'FIREBIRD_HOST',
  FB_DATABASE: 'FIREBIRD_DATABASE',
  FB_PORT: 'FIREBIRD_PORT',
  FB_CONNECT_STRING: 'FIREBIRD_CONNECT_STRING',
  FB_URL: 'FIREBIRD_URL',
  FB_CONNECTION_STRING: 'FIREBIRD_CONNECTION_STRING'
};

/**
 * Possíveis nomes de variável já com a connect string completa
 * Ex: 201.20.35.230/3050:E:\\FTPBackup\\Integracao\\SPOSASCO.DATAWEB.CERT
 */
const connectStringKeys = [
  'FIREBIRD_CONNECT_STRING',
  'FIREBIRD_URL',
  'FIREBIRD_CONNECTION_STRING'
];

/**
 * Constrói um mapa de env todo em maiúsculo
 * e aplica os aliases legados.
 */
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

/**
 * Retorna a connect string final do Firebird.
 * 1) Se existir FIREBIRD_CONNECT_STRING (ou sinônimos), usa direto
 * 2) Senão, monta host[/port]:database a partir de FIREBIRD_HOST / FIREBIRD_DATABASE
 */
function getFirebirdConnectString() {
  const env = buildUppercaseEnvMap();

  // 1) tenta pegar connect string direta
  const directKey = connectStringKeys.find((key) => env[key]);
  if (directKey) {
    return env[directKey];
  }

  // 2) senão, exige HOST + DATABASE
  const missing = requiredKeys.filter((key) => !env[key]);
  if (missing.length) {
    const extras = `Defina ${connectStringKeys[0]} (ou sinônimos: ${connectStringKeys
      .slice(1)
      .join(', ')}) ou todas as variáveis obrigatórias (FIREBIRD_HOST/FIREBIRD_DATABASE).`;
    throw new Error(`Variáveis obrigatórias faltando: ${missing.join(', ')}. ${extras}`);
  }

  const hostWithPort = env.FIREBIRD_PORT
    ? `${env.FIREBIRD_HOST}/${env.FIREBIRD_PORT}`
    : env.FIREBIRD_HOST;

  return `${hostWithPort}:${env.FIREBIRD_DATABASE}`;
}

/**
 * Opcional: função para ser usada em health-check de env
 * (se der erro aqui, o deploy falha com uma mensagem clara)
 */
function validateEnvForStartup() {
  // Se não conseguir montar a string, explode aqui
  const conn = getFirebirdConnectString();
  console.log('[ENV] Firebird connect string OK:', conn);
}

module.exports = {
  getFirebirdConnectString,
  buildUppercaseEnvMap,
  validateEnvForStartup
};
