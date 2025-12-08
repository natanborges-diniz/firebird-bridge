// src/db/index.js

const Firebird = require('node-firebird');

// Configurações básicas do Firebird vindas do .env
const options = {
  host: process.env.FIREBIRD_HOST,
  port: Number(process.env.FIREBIRD_PORT || 3050),
  database: process.env.FIREBIRD_DATABASE,
  user: process.env.FIREBIRD_USER || 'SYSDBA',
  password: process.env.FIREBIRD_PASSWORD || 'masterkey',
  role: null,
  pageSize: 4096,
  charset: process.env.FIREBIRD_CHARSET || 'WIN1252',
  lowercase_keys: true // opcional, facilita trabalhar com chaves em minúsculo
};

// Pool de conexões (ajusta o 5 se quiser mais/menos conexões simultâneas)
const pool = Firebird.pool(5, options);

/**
 * Executa uma query no Firebird usando o pool.
 * sql: string da query
 * params: array de parâmetros (opcional)
 */
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.get((err, db) => {
      if (err) {
        console.error('Erro ao obter conexão do pool Firebird:', err);
        return reject(err);
      }

      db.query(sql, params, (queryErr, result) => {
        // Libera a conexão de volta pro pool
        db.detach();

        if (queryErr) {
          console.error('Erro ao executar query no Firebird:', queryErr);
          return reject(queryErr);
        }

        // result normalmente já vem como array de objetos
        resolve(result);
      });
    });
  });
}

/**
 * Ping simples no banco.
 * NUNCA dispara erro pra fora: retorna true (ok) ou false (falha).
 */
function pingDatabase() {
  return new Promise((resolve) => {
    pool.get((err, db) => {
      if (err) {
        console.error('Erro ao pingar o banco Firebird (pool.get):', err.message || err);
        return resolve(false);
      }

      db.detach((detachErr) => {
        if (detachErr) {
          console.error('Erro ao liberar conexão no ping do Firebird:', detachErr.message || detachErr);
          return resolve(false);
        }

        resolve(true);
      });
    });
  });
}

module.exports = {
  runQuery,
  pingDatabase
};
