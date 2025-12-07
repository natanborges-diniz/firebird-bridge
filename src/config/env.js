// src/config/env.js
// Carrega variáveis de ambiente, mas tolera ausência do dotenv em builds minimalistas.
try {
  // eslint-disable-next-line global-require
  require('dotenv').config();
} catch (err) {
  // Se dotenv não estiver instalado no ambiente de deploy, seguimos usando apenas process.env.
}

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

function resolveGetFirebirdConnectString(mod) {
  if (typeof mod === 'function') return mod;
  if (mod && typeof mod.getFirebirdConnectString === 'function') return mod.getFirebirdConnectString;
  if (mod && typeof mod.default === 'function') return mod.default;
  return null;
}

module.exports = {
  getFirebirdConnectString,
  buildUppercaseEnvMap,
  requiredKeys,
  connectStringKeys,
  resolveGetFirebirdConnectString
};

// Facilita import default (ESM) apontando para a função principal
module.exports.default = getFirebirdConnectString;
