const { createNativeClient, getDefaultLibraryFilename } = require('node-firebird-driver-native');

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = Promise.resolve(createNativeClient(getDefaultLibraryFilename()));
  }
  return clientPromise;
}

function validateEnv() {
  const hasFirebird = process.env.FIREBIRD_HOST && process.env.FIREBIRD_DATABASE;
  const hasLegacy = process.env.FB_HOST && process.env.FB_DATABASE;

  if (!hasFirebird && !hasLegacy) {
    throw new Error(
      'Variáveis de ambiente ausentes: FIREBIRD_HOST/FIREBIRD_DATABASE ou FB_HOST/FB_DATABASE'
    );
  }
}

function buildConnectString() {
  validateEnv();

  const host = process.env.FIREBIRD_HOST || process.env.FB_HOST;
  const database = process.env.FIREBIRD_DATABASE || process.env.FB_DATABASE;

  // Exemplo: 201.20.35.230:E:\\FTPBackup\\Integracao\\SPOSASCO.DATAWEB.CERT
  return `${host}:${database}`;
}

async function runQuery(sql, params = [], metadata = {}) {
  const client = await getClient();
  const connectString = buildConnectString();

  const attachment = await client.connect(connectString, {
    username: process.env.FIREBIRD_USER || process.env.FB_USER || 'SYSDBA',
    password: process.env.FIREBIRD_PASSWORD || process.env.FB_PASSWORD || 'masterkey'
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
