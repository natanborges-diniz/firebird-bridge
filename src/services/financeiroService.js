// src/services/financeiroService.js

const path = require('path');
const fs = require('fs');
const db = require('../db');
const { getEmpresasLogicas } = require('./empresaService');

function loadSql(fileName) {
  const filePath = path.join(__dirname, '..', '..', 'queries', 'financeiro', fileName);
  return fs.readFileSync(filePath, 'utf8');
}

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
  // ⚠️ IMPORTANTE: a SQL tem 4 "?":
  //   fl.cod_empresa = cast(? as integer)
  //   cast(? as integer) in (13,18)
  //   between cast(? as date) and cast(? as date)
  //
  // então precisamos mandar 4 parâmetros:
  const params = [empresa, empresa, dataInicio, dataFim];
  const rows = await db.runQuery(sqlParcelas, params);
  return rows;
}

/**
 * PARCELAS com suporte a:
 * - single: uma empresa
 * - multi: várias empresas
 * - all: todas empresas lógicas válidas
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
 * DRE (mantém 3 parâmetros, a não ser que sua SQL de DRE também tenha 4 "?")
 */
async function getDreSingle({ empresa, dataInicio, dataFim }) {
  if (!sqlDre) {
    throw new Error('Arquivo financeiro_dre.sql não encontrado em queries/financeiro');
  }

  const params = [empresa, dataInicio, dataFim];
  const rows = await db.runQuery(sqlDre, params);
  return rows;
}

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

/** Aliases legados (se algum lugar ainda chamar getParcelas/getDRE) */
async function getParcelas(params) {
  const { empresa, codEmpresa, dataInicio, dataFim, dataIni } = params || {};

  const emp =
    empresa != null
      ? Number(empresa)
      : codEmpresa != null
      ? Number(codEmpresa)
      : undefined;

  if (!emp) {
    throw new Error('Parâmetro "empresa" é obrigatório em getParcelas() legado.');
  }

  const inicio = dataInicio || dataIni;
  const fim = dataFim;

  return getParcelasSingle({
    empresa: emp,
    dataInicio: inicio,
    dataFim: fim,
  });
}

async function getDRE(params) {
  const { empresa, codEmpresa, dataInicio, dataFim, dataIni } = params || {};

  const emp =
    empresa != null
      ? Number(empresa)
      : codEmpresa != null
      ? Number(codEmpresa)
      : undefined;

  if (!emp) {
    throw new Error('Parâmetro "empresa" é obrigatório em getDRE() legado.');
  }

  const inicio = dataInicio || dataIni;
  const fim = dataFim;

  return getDreSingle({
    empresa: emp,
    dataInicio: inicio,
    dataFim: fim,
  });
}

module.exports = {
  getParcelasSingle,
  getParcelasComEmpresas,
  getDreSingle,
  getDreComEmpresas,
  getParcelas,
  getDRE,
};
