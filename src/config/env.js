// src/config/env.js
require('dotenv').config();

const requiredKeys = ['FIREBIRD_HOST', 'FIREBIRD_DATABASE'];

function assertEnv() {
  const missing = requiredKeys.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Variáveis obrigatórias faltando: ${missing.join(', ')}`);
  }
}

module.exports = {
  assertEnv,
  requiredKeys
};
