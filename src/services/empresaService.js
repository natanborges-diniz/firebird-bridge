const path = require("path");
const fs = require("fs");
const db = require("../db");

function loadSQL(relativePath) {
  const fullPath = path.join(__dirname, "..", "queries", relativePath);
  return fs.readFileSync(fullPath, "utf-8");
}

async function getEmpresas() {
  const sql = loadSQL("empresas/listarEmpresas.sql");
  const rows = await db.runQuery(sql);
  return rows;
}

module.exports = { getEmpresas };
