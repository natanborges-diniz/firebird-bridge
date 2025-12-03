// src/db.js
const Firebird = require('node-firebird');

const options = {
  host: process.env.FB_HOST,
  port: Number(process.env.FB_PORT || 3050),
  database: process.env.FB_DATABASE,
  user: process.env.FB_USER,
  password: process.env.FB_PASSWORD,
  lowercase_keys: false,
  blobAsText: true
};

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => {
      if (err) {
        console.error('❌ Erro ao conectar no Firebird:', err);
        return reject(err);
      }

      db.query(sql, params, (err, result) => {
        db.detach();
        if (err) {
          console.error('❌ Erro ao executar query Firebird:', err);
          return reject(err);
        }

        resolve(result);
      });
    });
  });
}

module.exports = { runQuery };
