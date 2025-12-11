// src/services/financeiroService.js

const path = require('path');
const fs = require('fs');
const db = require('../db'); // src/db/index.js
const { getEmpresasLogicas } = require('./empresaService');

/**
 * Helper para carregar SQL da pasta queries/financeiro
 */
function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "financeiro", fileName);
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
 * Constrói o filtro de empresas a partir dos parâmetros brutos (empresa, codEmpresa)
 * Suporta:
 *  - "1"               → { mode: 'single', empresas: [1] }
 *  - "1,9,13"          → { mode: 'multi',  empresas: [1,9,13] }
 *  - "ALL" / "TODAS"   → { mode: 'all',    empresas: null }
 *  - undefined         → { mode: 'all',    empresas: null }
 */
function buildEmpresaFilterFromParams(empresaParam, codEmpresaParam) {
  const raw = empresaParam != null ? String(empresaParam) : codEmpresaParam != null ? String(codEmpresaParam) : '';

  if (!raw || raw.trim() === '') {
    // Sem empresa → todas
    return { mode: 'all', empresas: null };
  }

  const upper = raw.trim().toUpperCase();
  if (upper === 'ALL' || upper === 'TODAS') {
    return { mode: 'all', empresas: null };
  }

  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const nums = parts.map((p) => Number(p)).filter((n) => !Number.isNaN(n));

  if (nums.length === 0) {
    // Nada válido → todas
    return { mode: 'all', empresas: null };
  }

  if (nums.length === 1) {
    return { mode: 'single', empresas: [nums[0]] };
  }

  return { mode: 'multi', empresas: nums };
}

/**
 * PARCELAS
 * Busca parcelas para UMA empresa (single)
 * @param {number} empresa
 * @param {string} dataInicio - 'YYYY-MM-DD'
 * @param {string} dataFim    - 'YYYY-MM-DD'
 */
async function getParcelasSingle({ empresa, dataInicio, dataFim }) {
  // A SQL tem 4 "?":
  //   fl.cod_empresa = cast(? as integer)
  //   cast(? as integer) in (13, 18)
  //   between cast(? as date) and cast(? as date)
  const params = [empresa, empresa, dataInicio, dataFim];
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

  // Aqui supomos que o DRE tem 3 parâmetros: (empresa, dataInicio, dataFim)
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

/**
 * 🔁 ALIASES de compatibilidade (controllers antigos)
 * Agora:
 *  - suportam empresa=1
 *  - empresa=1,9,13
 *  - empresa=ALL / TODAS
 *  - empresa ausente → ALL
 */
async function getParcelas(params) {
  const { empresa, codEmpresa, dataInicio, dataFim, dataIni } = params || {};

  const empresaFilter = buildEmpresaFilterFromParams(empresa, codEmpresa);

  const inicio = dataInicio || dataIni;
  const fim = dataFim;

  if (!inicio || !fim) {
    throw new Error('Parâmetros "dataInicio"/"dataFim" são obrigatórios em getParcelas().');
  }

  return getParcelasComEmpresas({
    empresaFilter,
    dataInicio: inicio,
    dataFim: fim,
  });
}

async function getDRE(params) {
  const { empresa, codEmpresa, dataInicio, dataFim, dataIni } = params || {};

  const empresaFilter = buildEmpresaFilterFromParams(empresa, codEmpresa);

  const inicio = dataInicio || dataIni;
  const fim = dataFim;

  if (!inicio || !fim) {
    throw new Error('Parâmetros "dataInicio"/"dataFim" são obrigatórios em getDRE().');
  }

  return getDreComEmpresas({
    empresaFilter,
    dataInicio: inicio,
    dataFim: fim,
  });
}

module.exports = {
  // novas APIs
  getParcelasSingle,
  getParcelasComEmpresas,
  getDreSingle,
  getDreComEmpresas,

  // compatibilidade
  getParcelas,
  getDRE,
};
