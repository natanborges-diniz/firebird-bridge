const fs = require("fs");
const path = require("path");
const db = require("../db");

function loadSQL(relativePath) {
  // Caminho CORRETO para pasta queries na raiz do app
  const fullPath = path.join(__dirname, "..", "queries", relativePath);

  if (!fs.existsSync(fullPath)) {
    console.error("❌ SQL FILE NOT FOUND:", fullPath); 
    throw new Error("SQL file not found: " + fullPath);
  }

  return fs.readFileSync(fullPath, "utf-8");
}

async function getEmpresas() {
  const sql = loadSQL("empresas/listarEmpresas.sql");
  const rows = await db.runQuery(sql);
  return rows;
}

module.exports = { getEmpresas };
