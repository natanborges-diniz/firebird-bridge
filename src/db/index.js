// src/db/index.js

let firebirdModule = null;

function getFirebird() {
  if (firebirdModule) {
    return firebirdModule;
  }

  try {
    firebirdModule = require('node-firebird');
    return firebirdModule;
  } catch (err) {
    console.error('Dependência node-firebird não instalada/carregada:', err.message || err);
    return null;
  }
}

// Configurações do Firebird vindas do .env
const options = {
  host: process.env.FIREBIRD_HOST,
  port: Number(process.env.FIREBIRD_PORT || 3050),
  database: process.env.FIREBIRD_DATABASE,
  user: process.env.FIREBIRD_USER || 'SYSDBA',
  password: process.env.FIREBIRD_PASSWORD || 'masterkey',
  role: null,
  pageSize: 4096,
  charset: process.env.FIREBIRD_CHARSET || 'WIN1252',
  lowercase_keys: true
};

/**
 * Executa uma query no Firebird.
 * sql: string
 * params: array de parâmetros (opcional)
 */
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const Firebird = getFirebird();

    if (!Firebird) {
      return reject(new Error('node-firebird não está disponível no ambiente atual'));
    }

    Firebird.attach(options, (err, db) => {
      if (err) {
        console.error('Erro ao conectar ao Firebird:', err);
        return reject(err);
      }

      db.query(sql, params, (queryErr, result) => {
        // sempre tentar liberar a conexão
        db.detach(() => {
          if (queryErr) {
            console.error('Erro ao executar query no Firebird:', queryErr);
            return reject(queryErr);
          }

          resolve(result);
        });
      });
    });
  });
}

/**
 * Ping simples no banco.
 * Retorna { ok: true } em caso de sucesso,
 * ou { ok: false, error: 'mensagem' } em caso de falha.
 */
function pingDatabase() {
  return new Promise((resolve) => {
    const Firebird = getFirebird();

    if (!Firebird) {
      return resolve({ ok: false, error: 'node-firebird não está disponível no ambiente atual' });
    }

    Firebird.attach(options, (err, db) => {
      if (err) {
        console.error('Erro ao pingar o banco Firebird:', err.message || err);
        return resolve({ ok: false, error: err.message || String(err) });
      }

      db.detach((detachErr) => {
        if (detachErr) {
          console.error('Erro ao liberar conexão no ping do Firebird:', detachErr.message || detachErr);
          return resolve({ ok: false, error: detachErr.message || String(detachErr) });
        }

        resolve({ ok: true });
      });
    });
  });
}

module.exports = {
  runQuery,
  pingDatabase,
  // alias pra manter compatibilidade com services antigos
  query: runQuery
};
