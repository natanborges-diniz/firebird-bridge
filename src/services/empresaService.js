// src/services/empresaService.js
const fs = require("fs");
const path = require("path");
const db = require("../db");

/**
 * Carrega um arquivo .sql a partir da pasta /queries
 * Estrutura esperada:
 *   firebird-bridge/
 *     queries/
 *       empresas/
 *         listarEmpresas.sql
 */
function loadSQL(relativePath) {
  // __dirname = /app/src/services
  // ..        = /app/src
  // ../..     = /app
  // /queries/relativePath = /app/queries/empresas/listarEmpresas.sql
  const fullPath = path.join(__dirname, "..", "..", "queries", relativePath);

  if (!fs.existsSync(fullPath)) {
    console.error("❌ SQL FILE NOT FOUND:", fullPath);
    throw new Error("SQL file not found: " + fullPath);
  }

  return fs.readFileSync(fullPath, "utf8");
}

async function getEmpresas() {
  const sql = loadSQL("empresas/listarEmpresas.sql");
  // db.runQuery já existe e é usado nos outros services (financeiro, vendas, etc.)
  const rows = await db.runQuery(sql);
  return rows;
}

module.exports = {
  getEmpresas,
};
