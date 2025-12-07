// src/config/env.js
require('dotenv').config();

const requiredKeys = ['FIREBIRD_HOST', 'FIREBIRD_DATABASE'];
const legacyKeys = {
  FIREBIRD_HOST: 'FB_HOST',
  FIREBIRD_DATABASE: 'FB_DATABASE'
};
const connectStringKeys = [
  // aceita conexão direta já formatada ex.: 201.20.35.230/3050:/caminho/db.FDB
  'FIREBIRD_CONNECT_STRING',
  'FIREBIRD_URL',
  'FIREBIRD_CONNECTION_STRING'
];

function getFirebirdConnectString() {
  const connectString = connectStringKeys
    .map((key) => process.env[key])
    .find(Boolean);

  if (connectString) {
    return connectString;
  }

  const missing = requiredKeys.filter(
    (key) => !process.env[key] && !process.env[legacyKeys[key]]
  );

  if (missing.length) {
    const extras = `Defina ${connectStringKeys[0]} (ou sinônimos: ${connectStringKeys
      .slice(1)
      .join(', ')}) ou todas as variáveis obrigatórias (aceitamos legadas: FB_HOST/FB_DATABASE).`;
    throw new Error(`Variáveis obrigatórias faltando: ${missing.join(', ')}. ${extras}`);
  }

  const host = process.env.FIREBIRD_HOST || process.env.FB_HOST;
  const port = process.env.FIREBIRD_PORT || process.env.FB_PORT;
  const database = process.env.FIREBIRD_DATABASE || process.env.FB_DATABASE;
  const hostWithPort = port ? `${host}/${port}` : host;

  return `${hostWithPort}:${database}`;
}

module.exports = {
  getFirebirdConnectString,
  requiredKeys,
  connectStringKeys
};
