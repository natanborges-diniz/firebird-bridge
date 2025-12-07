const { createNativeClient, getDefaultLibraryFilename } = require('node-firebird-driver-native');
const envModule = require('../config/env');
const { resolveGetFirebirdConnectString } = envModule;
const getFirebirdConnectString = resolveGetFirebirdConnectString(envModule);

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = Promise.resolve(createNativeClient(getDefaultLibraryFilename()));
  }
  return clientPromise;
}

async function runQuery(sql, params = [], metadata = {}) {
  const client = await getClient();
  if (typeof getFirebirdConnectString !== 'function') {
    throw new Error('getFirebirdConnectString não foi exportada de src/config/env');
  }
  const connectString = getFirebirdConnectString();

  const attachment = await client.connect(connectString, {
    username: process.env.FIREBIRD_USER || 'SYSDBA',
    password: process.env.FIREBIRD_PASSWORD || 'masterkey'
  });

  const transaction = await attachment.startTransaction();
  const startedAt = Date.now();

  try {
    const resultSet = await attachment.executeQuery(transaction, sql, params);
    const rows = await resultSet.fetch();
    await resultSet.close();
    await transaction.commit();
    await attachment.disconnect();

    const duration = Date.now() - startedAt;
    console.info(
      `[DB] ${metadata.label || 'query'} ok (${duration}ms) params=${params.length}`
    );

    return rows;
  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    try { await attachment.disconnect(); } catch (_) {}
    console.error('Erro ao executar query Firebird:', err);
    throw err;
  }
}

async function pingDatabase() {
  // Query simples que não depende de tabelas do cliente
  await runQuery('SELECT 1 AS alive FROM RDB$DATABASE', [], { label: 'healthcheck' });
}

module.exports = {
  runQuery,
  pingDatabase,
  // alias pra compatibilizar com outros arquivos que usem "query"
  query: runQuery
};
