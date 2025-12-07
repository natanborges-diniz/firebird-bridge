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

// Exporta como função principal para que `require('./env')` retorne algo chamável
// em runtimes que esperam o módulo como função direta.
module.exports = getFirebirdConnectString;

// Também expõe propriedades nomeadas para compatibilidade com imports por desestruturação.
module.exports.getFirebirdConnectString = getFirebirdConnectString;
module.exports.buildUppercaseEnvMap = buildUppercaseEnvMap;
module.exports.requiredKeys = requiredKeys;
module.exports.connectStringKeys = connectStringKeys;

// Facilita import default (ESM) apontando para a função principal
module.exports.default = getFirebirdConnectString;
