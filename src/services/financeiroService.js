// src/services/financeiroService.js

const path = require('path');
const fs = require('fs');
const db = require('../db');
const empresaService = require('./empresaService'); // mesma pasta

/**
 * Carrega SQL da pasta /app/queries/financeiro
 *
 * __dirname = /app/src/services
 * ..        = /app/src
 * ..        = /app
 * queries/financeiro = /app/queries/financeiro
 */
function loadSql(filename) {
  const filePath = path.join(__dirname, '..', '..', 'queries', 'financeiro', filename);

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[FINANCEIRO] SQL FILE NOT FOUND: ${filePath}`);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// SQLs
// -----------------------------------------------------------------------------
const SQL_PARCELAS = loadSql('financeiro_parcelas.sql');
// Se tiver DRE depois podemos reaproveitar o mesmo padrão:
// const SQL_DRE = loadSql('financeiro_dre.sql');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Faz a query de parcelas PARA UMA EMPRESA física (um código só).
 *
 * A SQL espera os parâmetros nesta ordem:
 *   1) cod_empresa (para fl.cod_empresa = ?)
 *   2) cod_empresa (para o caso especial 13/18)
 *   3) dataInicio
 *   4) dataFim
 */
async function getParcelasPorEmpresa(codEmpresa, dataInicio, dataFim) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim];
  return db.runQuery(SQL_PARCELAS, params);
}

/**
 * Normaliza string de empresas em lista de inteiros únicos.
 *
 * Ex:
 *   "1, 9,13" -> [1, 9, 13]
 */
function parseEmpresasLista(empresaStr) {
  if (!empresaStr) return [];

  return Array.from(
    new Set(
      empresaStr
        .split(',')
        .map((s) =>
