// src/db/index.js

const Firebird = require('node-firebird');

const options = {
  host: process.env.FB_HOST,
  port: process.env.FB_PORT || 3050,
  database: process.env.FB_DATABASE,
  user: process.env.FB_USER || 'SYSDBA',
  password: process.env.FB_PASSWORD || 'masterkey',
  lowercase_keys: false,
  role: null,
  pageSize: 8192
};

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => {
      if (err) {
        console.error('Erro ao conectar ao Firebird:', err);
        return reject(err);
      }

      db.query(sql, params, (err, result) => {
        db.detach();

        if (err) {
          console.error('Erro ao executar query Firebird:', err);
          return reject(err);
        }

        resolve(result);
      });
    });
  });
}

// Alias para manter compatível com quem usa "query"
module.exports = {
  runQuery,
  query: runQuery
};
