const { createNativeClient, getDefaultLibraryFilename } = require('node-firebird-driver-native');

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = Promise.resolve(createNativeClient(getDefaultLibraryFilename()));
  }
  return clientPromise;
}

function validateEnv() {
  const required = ['FIREBIRD_HOST', 'FIREBIRD_DATABASE'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Variáveis de ambiente ausentes: ${missing.join(', ')}`);
  }
}

function buildConnectString() {
  validateEnv();

  const host = process.env.FIREBIRD_HOST;
  const port = process.env.FIREBIRD_PORT;
  const database = process.env.FIREBIRD_DATABASE;

  // Exemplo: 201.20.35.230/3058:E:\\FTPBackup\\Integracao\\SPOSASCO.DATAWEB.CERT
  const hostWithPort = port ? `${host}/${port}` : host;
  return `${hostWithPort}:${database}`;
}

async function runQuery(sql, params = [], metadata = {}) {
  const client = await getClient();
  const connectString = buildConnectString();

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
