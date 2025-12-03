// src/utils/loadSQL.js
const fs = require('fs');
const path = require('path');

function loadSQL(relativePath) {
  // Base: <raiz do projeto>/queries
  const baseDir = path.join(__dirname, '..', '..', 'queries');
  const filePath = path.join(baseDir, relativePath);

  return fs.readFileSync(filePath, 'utf8');
}

module.exports = { loadSQL };
