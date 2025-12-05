const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js

// 🔹 Caminho correto: /app/queries/financeiro/financeiro_parcelas.sql
const sqlParcelasPath = path.join(
  __dirname,      // /app/src/services
  "..",           // /app/src
  "..",           // /app
  "queries",
  "financeiro",
  "financeiro_parcelas.sql"
);

const sqlParcelas = fs.readFileSync(sqlParcelasPath, "utf8");

// helper pra converter "YYYY-MM-DD" em Date (Firebird entende melhor)
function parseDateYmd(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa
 * @param {string} dataIni - 'YYYY-MM-DD'
 * @param {string} dataFim - 'YYYY-MM-DD'
 * @param {number|string} codEmpresa
 */
async function getParcelas({ dataIni, dataFim, codEmpresa }) {
  // 👇 converte string pra Date pra evitar o erro -303 do Firebird
  const ini = parseDateYmd(dataIni);
  const fim = parseDateYmd(dataFim);

  const params = [ini, fim, Number(codEmpresa)];

  const rows = await db.query(sqlParcelas, params);
  return rows;
}

module.exports = {
  getParcelas,
};
