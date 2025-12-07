// src/config/env.js
require('dotenv').config();

const requiredKeys = ['FIREBIRD_HOST', 'FIREBIRD_DATABASE'];
const legacyKeys = ['FB_HOST', 'FB_DATABASE'];

function assertEnv() {
  const hasRequired = requiredKeys.every((key) => !!process.env[key]);
  const hasLegacy = legacyKeys.every((key) => !!process.env[key]);

  if (!hasRequired && !hasLegacy) {
    throw new Error(
      `Variáveis obrigatórias faltando: ${requiredKeys.join(', ')} ou ${legacyKeys.join(', ')}`
    );
  }
}

module.exports = {
  assertEnv,
  requiredKeys,
  legacyKeys
};
