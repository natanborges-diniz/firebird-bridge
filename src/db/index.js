// src/db/index.js

const { createNativeClient, getDefaultLibraryFilename } = require('node-firebird-driver-native');
const { getFirebirdConnectString } = require('../config/env');

let clientPromise = null;

/**
 * Garante singleton do client nativo do Firebird
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
 * Executa uma query no Firebird.
 * sql: string com a consulta
 * params: array opcional de parâmetros
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
      // ajuste charset se necessário: 'UTF8', 'WIN1252', etc.
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
    // tentativa de rollback/fechamento
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (_) {}
    }

    if (attachment) {
      try {
        await attachment.disconnect();
      } catch (_) {}
    }

    // aqui poderíamos mapear erros específicos de conexão,
    // mas para a Issue 02 basta não derrubar o servidor.
    throw err;
  }
}

/**
 * Ping simples no banco: true = ok, false = falha
 */
async function pingDatabase() {
  const client = await getClient();
  let attachment;

  try {
    const connectString = getFirebirdConnectString();

    attachment = await client.connect(connectString, {
      user: process.env.FIREBIRD_USER,
      password: process.env.FIREBIRD_PASSWORD,
      charset: process.env.FIREBIRD_CHARSET || 'WIN1252'
    });

    await attachment.disconnect();
    return true;
  } catch (err) {
    console.error('Erro ao pingar o banco Firebird:', err.message || err);
    return false;
  }
}

module.exports = {
  runQuery,
  pingDatabase,
  getClient
};
