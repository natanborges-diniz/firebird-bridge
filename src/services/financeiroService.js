// src/services/financeiroService.js

const path = require('path');
const fs = require('fs');
const db = require('../db'); // src/db/index.js
const { getEmpresasLogicas } = require('./empresaService');

/**
 * Helper para carregar SQL da pasta queries/financeiro
 */
function loadSql(fileName) {
  // __dirname = /app/src/services
  const filePath = path.join(__dirname, '..', '..', 'queries', 'financeiro', fileName);
  return fs.readFileSync(filePath, 'utf8');
}

// SQLs
const sqlParcelas = loadSql('financeiro_parcelas.sql');

let sqlDre;
try {
  sqlDre = loadSql('financeiro_dre.sql');
} catch (e) {
  console.warn(
    '[financeiroService] Atenção: financeiro_dre.sql ainda não existe. DRE vai falhar até criar o arquivo.'
  );
}

/**
 * PARCELAS
 * Busca parcelas para UMA empresa (single)
 * @param {number} empresa
 * @param {string} dataInicio - 'YYYY-MM-DD'
 * @param {string} dataFim    - 'YYYY-MM-DD'
 */
async function getParcelasSingle({ empresa, dataInicio, dataFim }) {
  // Ordem deve bater com a query:
  // where fl.cod_empresa = ?
  //   and fp.datavencimento between ? and ?
  const params = [empresa, dataInicio, dataFim];
  const rows = await db.runQuery(sqlParcelas, params);
  return rows;
}

/**
 * PARCELAS com suporte a:
 * - single: uma empresa
 * - multi: várias empresas
 * - all: todas empresas lógicas válidas
 *
 * @param {object} opts
 * @param {{mode: 'single'|'multi'|'all', empresas: number[]|null}} opts.empresaFilter
 * @param {string} opts.dataInicio
 * @param {string} opts.dataFim
 */
async function getParcelasComEmpresas({ empresaFilter, dataInicio, dataFim }) {
  if (empresaFilter.mode === 'single') {
    const cod = empresaFilter.empresas[0];
    return getParcelasSingle({ empresa: cod, dataInicio, dataFim });
  }

  let empresas;

  if (empresaFilter.mode === 'multi') {
    empresas = empresaFilter.empresas;
  } else {
    // mode === 'all' → buscar todas empresas lógicas válidas
    const lista = await getEmpresasLogicas();
    empresas = lista.map((e) => e.codEmpresa);
  }

  const results = await Promise.all(
    empresas.map((codEmpresa) =>
      getParcelasSingle({ empresa: codEmpresa, dataInicio, dataFim })
    )
  );

  return results.flat();
}

/**
 * DRE
 * Busca DRE para UMA empresa (single)
 * @param {number} empresa
 * @param {string} dataInicio - 'YYYY-MM-DD'
 * @param {string} dataFim    - 'YYYY-MM-DD'
 */
async function getDreSingle({ empresa, dataInicio, dataFim }) {
  if (!sqlDre) {
    throw new Error('Arquivo financeiro_dre.sql não encontrado em queries/financeiro');
  }

  // ordem deve bater com a query DRE
  const params = [empresa, dataInicio, dataFim];
  const rows = await db.runQuery(sqlDre, params);
  return rows;
}

/**
 * DRE com suporte a single/multi/all empresas
 */
async function getDreComEmpresas({ empresaFilter, dataInicio, dataFim }) {
  if (empresaFilter.mode === 'single') {
    const cod = empresaFilter.empresas[0];
    return getDreSingle({ empresa: cod, dataInicio, dataFim });
  }

  let empresas;

  if (empresaFilter.mode === 'multi') {
    empresas = empresaFilter.empresas;
  } else {
    const lista = await getEmpresasLogicas();
    empresas = lista.map((e) => e.codEmpresa);
  }

  const results = await Promise.all(
    empresas.map((codEmpresa) =>
      getDreSingle({ empresa: codEmpresa, dataInicio, dataFim })
    )
  );

  return results.flat();
}

module.exports = {
  // single (se precisar em algum lugar específico)
  getParcelasSingle,
  getDreSingle,

  // multi/all (usado pelos controllers)
  getParcelasComEmpresas,
  getDreComEmpresas,
};
