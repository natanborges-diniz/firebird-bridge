// src/services/vendasService.js

const path = require('path');
const fs = require('fs');
const db = require('../db');
const { parseEmpresasParam } = require('../utils/empresaHelper');

/**
 * Carrega SQL da pasta /app/queries/vendas
 *
 * __dirname = /app/src/services
 * ..        = /app/src
 * ..        = /app
 * queries/vendas = /app/queries/vendas
 */
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

/**
 * Resumo de vendas por empresa/vendedor PARA UMA empresa
 *
 * Parâmetros esperados na SQL (ajuste se necessário):
 *   1) cod_empresa
 *   2) cod_empresa (de novo, para regra do 13/18)
 *   3) dataInicio
 *   4) dataFim
 */
async function getResumoEmpresaVendedorPorEmpresa(codEmpresa, dataInicio, dataFim) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim];
  return db.runQuery(SQL_RESUMO_EMPRESA_VENDEDOR, params);
}

/**
 * Resumo de formas de pagamento PARA UMA empresa
 *
 * Mesmo padrão de parâmetros da SQL acima:
 *   1) cod_empresa
 *   2) cod_empresa (13/18)
 *   3) dataInicio
 *   4) dataFim
 */
async function getFormasPagamentoResumoPorEmpresa(codEmpresa, dataInicio, dataFim) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim];
  return db.runQuery(SQL_FORMAS_PAGAMENTO_RESUMO, params);
}

/**
 * API principal: Resumo por empresa/vendedor (suporta:
 *  - empresa=ALL
 *  - empresa=1
 *  - empresa=1,9,13
 */
async function getResumoEmpresaVendedor({ empresa, dataInicio, dataFim }) {
  const empresas = parseEmpresasParam(empresa);
  let allRows = [];

  for (const cod of empresas) {
    try {
      const rows = await getResumoEmpresaVendedorPorEmpresa(cod, dataInicio, dataFim);
      if (rows && rows.length > 0) {
        allRows = allRows.concat(rows);
      }
    } catch (err) {
      console.error(
        `[VENDAS] Erro ao buscar resumo empresa-vendedor para empresa ${cod}:`,
        err.message || err
      );
      // segue para as demais empresas
    }
  }

  return allRows;
}

/**
 * API principal: Resumo por formas de pagamento (suporta:
 *  - empresa=ALL
 *  - empresa=1
 *  - empresa=1,9,13
 */
async function getFormasPagamentoResumo({ empresa, dataInicio, dataFim }) {
  const empresas = parseEmpresasParam(empresa);
  let allRows = [];

  for (const cod of empresas) {
    try {
      const rows = await getFormasPagamentoResumoPorEmpresa(cod, dataInicio, dataFim);
      if (rows && rows.length > 0) {
        allRows = allRows.concat(rows);
      }
    } catch (err) {
      console.error(
        `[VENDAS] Erro ao buscar resumo formas de pagamento para empresa ${cod}:`,
        err.message || err
      );
    }
  }

  return allRows;
}

/**
 * Análise por família/vendedor
 *
 * Aqui depende MAIS do desenho da sua SQL.
 * Deixo um exemplo básico considerando parâmetros:
 *
 *   where
 *     ... regra de empresa ...
 *     and transacao.dataencerramento between cast(? as date) and cast(? as date)
 *     and (? is null or t.cod_empresaestoque = ?)
 *
 * => Parâmetros possíveis:
 *   1) cod_empresa        (regra 13/18 - opcional, depende da sua SQL)
 *   2) cod_empresa        (de novo)
 *   3) dataInicio
 *   4) dataFim
 *   5) codEmpresaEstoqueFiltro (ou null)
 *   6) codEmpresaEstoqueFiltro (ou null)
 *
 * Se hoje a sua SQL já está funcionando com um único codEmpresa,
 * você pode manter o comportamento atual (sem ALL) e só receber empresa única.
 */
async function getAnaliseFamiliaVendedor({ empresa, dataInicio, dataFim, codEmpresaEstoque }) {
  // Versão simples: assume que sua SQL já trata empresa internamente
  // e só precisa de dataInicio, dataFim e, opcionalmente, um codEmpresa.
  //
  // Se quiser suportar ALL e múltiplas empresas também aqui,
  // dá pra aplicar o mesmo padrão dos métodos acima.
  const params = [dataInicio, dataFim, codEmpresaEstoque || null];
  return db.runQuery(SQL_ANALISE_FAMILIA_VENDEDOR, params);
}

module.exports = {
  getResumoEmpresaVendedor,
  getFormasPagamentoResumo,
  getAnaliseFamiliaVendedor,
};
