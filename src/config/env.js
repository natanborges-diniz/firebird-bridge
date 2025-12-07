require('dotenv').config();

const requiredKeys = ['FIREBIRD_HOST', 'FIREBIRD_DATABASE'];
const connectStringKeys = [
  // aceita conexão direta já formatada ex.: 201.20.35.230/3050:/caminho/db.FDB
  'FIREBIRD_CONNECT_STRING',
  'FIREBIRD_URL',
  'FIREBIRD_CONNECTION_STRING'
];

function getEnvValue(keys) {
  // tenta valor exato e, em seguida, busca case-insensitive (alguns providers
  // convertem nomes de variáveis inadvertidamente)
  for (const key of keys) {
    if (process.env[key]) return process.env[key];

    const foundKey = Object.keys(process.env).find(
      (k) => k.toUpperCase() === key.toUpperCase()
    );

    if (foundKey && process.env[foundKey]) return process.env[foundKey];
  }

  return undefined;
}

function getFirebirdConnectString() {
  const connectString = getEnvValue(connectStringKeys);

  if (connectString) {
    return connectString;
  }

  const host = getEnvValue(['FIREBIRD_HOST']);
  const database = getEnvValue(['FIREBIRD_DATABASE']);
  const port = getEnvValue(['FIREBIRD_PORT']);

  const missing = requiredKeys.filter((key) => !getEnvValue([key]));

  if (missing.length) {
    const extras = `Defina ${connectStringKeys[0]} (ou sinônimos: ${connectStringKeys
      .slice(1)
      .join(', ')}) ou todas as variáveis obrigatórias (FIREBIRD_HOST/FIREBIRD_DATABASE).`;
    throw new Error(`Variáveis obrigatórias faltando: ${missing.join(', ')}. ${extras}`);
  }

  const hostWithPort = port ? `${host}/${port}` : host;

  return `${hostWithPort}:${database}`;
}
src/config/env.js
