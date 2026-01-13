// src/services/empresaService.js

const path = require('path');
const fs = require('fs');
const db = require('../db');
const { LONG_TTL_MS, getCachedOrFetch } = require('../utils/queryCache');

/**
 * Carrega SQL da pasta /app/queries/empresas
 *
 * __dirname = /app/src/services
 * ..        = /app/src
 * ..        = /app
 * queries/empresas = /app/queries/empresas
 */
function loadSql(filename) {
  const filePath = path.join(__dirname, '..', '..', 'queries', 'empresas', filename);

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[EMPRESA] SQL FILE NOT FOUND: ${filePath}`);
    throw err;
  }
}

// SQL principal
const SQL_LISTAR_EMPRESAS = loadSql('listarEmpresas.sql');

/**
 * Retorna a lista de empresas “cruas” vinda do Firebird.
 * Depende do conteúdo de queries/empresas/listarEmpresas.sql
 */
async function getEmpresas(options = {}) {
  const params = [];
  const cacheLabel = 'empresa.listar';
  return getCachedOrFetch({
    label: cacheLabel,
    params,
    ttlMs: options.cacheTtlMs ?? LONG_TTL_MS,
    enabled: options.useCache !== false,
    fetcher: () => db.runQuery(SQL_LISTAR_EMPRESAS),
  });
}

/**
 * Helper para pegar um campo independente do nome exato.
 * Tenta uma lista de candidatos e devolve o primeiro que existir.
 */
function getField(row, candidates) {
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, c)) {
      return row[c];
    }
  }
  return undefined;
}

/**
 * Empresas lógicas para filtros:
 *  - Remove empresas “lixo”: 3, 5, 7, 8, 11, 12
 *  - Une as empresas 13 e 18 em uma só “DINIZ SUPER” (codEmpresa = 13)
 *
 * Retorno:
 * [
 *   { codEmpresa: 1,  empresaNome: 'DINIZ PRIMITIVA I' },
 *   { codEmpresa: 9,  empresaNome: 'DINIZ ANTONIO AGU' },
 *   { codEmpresa: 13, empresaNome: 'DINIZ SUPER' },
 *   ...
 * ]
 */
async function getEmpresasLogicas(options = {}) {
  const rows = await getEmpresas(options);

  const lixo = new Set([3, 5, 7, 8, 11, 12]);
  const map = new Map(); // key = cod_logico, value = { codEmpresa, empresaNome }

  for (const row of rows) {
    const codOriginal = Number(
      getField(row, ['COD_EMPRESA', 'EMPRESA', 'EMPRESA_COD', 'EMPRESAID', 'EMPRESA_CODIGO'])
    );

    if (!codOriginal || Number.isNaN(codOriginal)) continue;
    if (lixo.has(codOriginal)) continue;

    const nomeOriginal =
      getField(row, ['EMPRESA_NOME', 'NOME', 'NOME_FANTASIA', 'RAZAO_SOCIAL']) || '';

    let codLogico = codOriginal;
    let nomeLogico = nomeOriginal;

    if (codOriginal === 13 || codOriginal === 18) {
      codLogico = 13;
      nomeLogico = 'DINIZ SUPER';
    }

    if (!map.has(codLogico)) {
      map.set(codLogico, {
        codEmpresa: codLogico,
        empresaNome: nomeLogico,
      });
    }
  }

  return Array.from(map.values());
}

module.exports = {
  getEmpresas,
  getEmpresasLogicas,
};
