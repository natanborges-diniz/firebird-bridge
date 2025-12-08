// src/db/index.js

const { createNativeClient, getDefaultLibraryFilename } = require('node-firebird-driver-native');
const { getFirebirdConnectString } = require('../config/env');

let clientPromise = null;

/**
 * Singleton do client Firebird
 */
function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = await createNativeClient(getDefaultLibraryFilename());
      return client;
    })();
  }
  return clientPromise;
}

/**
 * Executa query genérica
 */
async function runQuery(sql, params = []) {
  const client = await getClient();
  let attachment;
  let transaction;

  try {
    const connectString = getFirebirdConnectString();

    attachment = await client.connect(connectString, {
      user: process.env.FIREBIRD_USER,
      password: process.env.FIREBIRD_PASSWORD,
      charset: process.env.FIREBIRD_CHARSET || 'WIN1252'
    });

    transaction = await attachment.startTransaction();

    const resultSet = await transaction.executeQuery(sql, params);
    const rows = [];

    for await (const row of resultSet) {
      rows.push(row);
    }

    await resultSet.close();
    await transaction.commit();
    await attachment.disconnect();

    return rows;
  } catch (err) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    if (attachment) {
      try { await attachment.disconnect(); } catch (_) {}
    }
    throw err;
  }
}

/**
 * Ping simples no banco.
 * IMPORTANTE: NUNCA joga erro pra fora, só retorna true/false.
 */
async function pingDatabase() {
  let attachment;

  try {
    const client = await getClient();
    const connectString = getFirebirdConnectString();

    attachment = await client.connect(connectString, {
      user: process.env.FIREBIRD_USER,
      password: process.env.FIREBIRD_PASSWORD,
      charset: process.env.FIREBIRD_CHARSET || 'WIN1252'
    });

    await attachment.disconnect();
    return true;
  } catch (err) {
    console.error('Erro ao pingar o banco Firebird:', err && err.message ? err.message : err);
    // NÃO rethrow aqui – apenas indica falha
    return false;
  } finally {
    if (attachment) {
      try { await attachment.disconnect(); } catch (_) {}
    }
  }
}

module.exports = {
  runQuery,
  pingDatabase,
  getClient
};
