// src/db/index.js

const { createNativeClient, getDefaultLibraryFilename } = require('node-firebird-driver-native');

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = Promise.resolve(createNativeClient(getDefaultLibraryFilename()));
  }
  return clientPromise;
}

function buildConnectString() {
  // Exemplo: 201.20.35.230:E:\\FTPBackup\\Integracao\\SPOSASCO.DATAWEB.CERT
  const host = process.env.FIREBIRD_HOST;
  const database = process.env.FIREBIRD_DATABASE;

  if (!host || !database) {
    throw new Error('FIREBIRD_HOST ou FIREBIRD_DATABASE não configurados nas variáveis de ambiente');
  }

  return `${host}:${database}`;
}

async function runQuery(sql, params = []) {
  const client = await getClient();
  const connectString = buildConnectString();

  const attachment = await client.connect(connectString, {
    username: process.env.FIREBIRD_USER || 'SYSDBA',
    password: process.env.FIREBIRD_PASSWORD || 'masterkey'
  });

  const transaction = await attachment.startTransaction();

  try {
    const resultSet = await attachment.executeQuery(transaction, sql, params);
    const rows = await resultSet.fetch();
    await resultSet.close();
    await transaction.commit();
    await attachment.disconnect();
    return rows;
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    try {
      await attachment.disconnect();
    } catch (_) {}
    console.error('Erro ao executar query Firebird:', err);
    throw err;
  }
}

module.exports = {
  runQuery
};
