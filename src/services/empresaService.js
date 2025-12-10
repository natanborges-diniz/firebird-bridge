const fs = require("fs");
const path = require("path");

function loadSQL(relativePath) {
  // Caminho absoluto correto no Railway: /app/queries/<...>.sql
  const fullPath = path.join(__dirname, "..", "queries", relativePath);

  if (!fs.existsSync(fullPath)) {
    console.error("❌ SQL FILE NOT FOUND:", fullPath);
    throw new Error("SQL file not found: " + fullPath);
  }

  return fs.readFileSync(fullPath, "utf8");
}

module.exports = loadSQL;
