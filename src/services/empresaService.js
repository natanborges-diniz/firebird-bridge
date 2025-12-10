// src/services/empresaService.js
const path = require("path");
const fs = require("fs");
const db = require("../db");

async function getEmpresas() {
  const sql = loadSQL('empresas/listarEmpresas.sql');
  const result = await db.runQuery(sql);
  return result;
}

module.exports = {
  getEmpresas
};
