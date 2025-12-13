// src/services/vendasService.js

const path = require('path');
const fs = require('fs');
const db = require('../db');
const { parseEmpresasParam } = require('../utils/empresaHelper');

function loadSql(filename) {
  const filePath = path.join(__dirname, '..', '..', 'queries', 'vendas', filename);

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[VENDAS] SQL FILE NOT FOUND: ${filePath}`);
    throw err;
  }
}

const SQL_RESUMO_EMPRESA_VENDEDOR = loadSql('resumo_empresa_vendedor.sql');
const SQL_FORMAS_PAGAMENTO_RESUMO = loadSql('formas_pagamento_resumo.sql');
const SQL_ANALISE_FAMILIA_VENDEDOR = loadSql('analise_familia_vendedor.sql');

// --------- QUERIES POR EMPRESA (executadas dentro do loop) ---------

async function getResumoEmpresaVendedorPorEmpresa(codEmpresa, dataInicio, dataFim) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim];
  return db.runQuery(SQL_RESUMO_EMPRESA_VENDEDOR, params);
}

async function getFormasPagamentoResumoPorEmpresa(codEmpresa, dataInicio, dataFim) {
  // 8 placeholders:
  // empresa, empresa, vendas (2), convenio (2), devolucao (2)
  const params = [
    codEmpresa,
    codEmpresa,
    dataInicio,
    dataFim,
    dataInicio,
    dataFim,
    dataInicio,
    dataFim,
  ];
  return db.runQuery(SQL_FORMAS_PAGAMENTO_RESUMO, params);
}

async function getAnaliseFamiliaVendedorPorEmpresa(codEmpresa, dataInicio, dataFim) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim];
  return db.runQuery(SQL_ANALISE_FAMILIA_VENDEDOR, params);
}

// --------- APIS PRINCIPAIS (empresa=ALL / múltiplas / única) ---------

async function getResumoEmpresaVendedor({ empresa, dataInicio, dataFim }) {
  const empresas = parseEmpresasParam(empresa);
  let allRows = [];

  for (const cod of empresas) {
    try {
      const rows = await getResumoEmpresaVendedorPorEmpresa(cod, dataInicio, dataFim);
      if (rows && rows.length) allRows = allRows.concat(rows);
    } catch (err) {
      console.error(`[VENDAS] resumo-empresa-vendedor empresa ${cod}:`, err.message || err);
    }
  }

  return allRows;
}

async function getFormasPagamentoResumo({ empresa, dataInicio, dataFim }) {
  const empresas = parseEmpresasParam(empresa);
  let allRows = [];

  for (const cod of empresas) {
    try {
      const rows = await getFormasPagamentoResumoPorEmpresa(cod, dataInicio, dataFim);
      if (rows && rows.length) allRows = allRows.concat(rows);
    } catch (err) {
      console.error(`[VENDAS] resumo-formas-pagamento empresa ${cod}:`, err.message || err);
    }
  }

  return allRows;
}

async function getAnaliseFamiliaVendedor({ empresa, dataInicio, dataFim }) {
  const empresas = parseEmpresasParam(empresa);
  let allRows = [];

  for (const cod of empresas) {
    try {
      const rows = await getAnaliseFamiliaVendedorPorEmpresa(cod, dataInicio, dataFim);
      if (rows && rows.length) allRows = allRows.concat(rows);
    } catch (err) {
      console.error(`[VENDAS] analise-familia-vendedor empresa ${cod}:`, err.message || err);
    }
  }

  return allRows;
}

module.exports = {
  getResumoEmpresaVendedor,
  getFormasPagamentoResumo,
  getAnaliseFamiliaVendedor,
};
