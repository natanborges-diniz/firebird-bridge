// src/services/vendasService.js
const path = require("path");
const fs = require("fs");
const db = require("../db");

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "vendas", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlResumoEmpresaVendedor   = loadSql("resumo_empresa_vendedor.sql");
const sqlResumoFormasPagamento   = loadSql("resumo_formas_pagamento.sql");
let   sqlAnaliseFamiliaVendedor;
try {
  sqlAnaliseFamiliaVendedor = loadSql("analise_familia_vendedor.sql");
} catch (e) {
  console.warn(
    "[vendasService] Atenção: analise_familia_vendedor.sql ainda não existe. " +
      "Endpoint /vendas/analise-familia-vendedor vai falhar até criar o arquivo."
  );
}

/**
 * Resumo por empresa x vendedor no período
 */
async function getResumoEmpresaVendedor({ dataIni, dataFim }) {
  // resumo_empresa_vendedor.sql agora espera APENAS:
  //  1) dataInicio
  //  2) dataFim
  const params = [dataIni, dataFim];

  const rows = await db.query(sqlResumoEmpresaVendedor, params);
  return rows;
}

/**
 * Resumo por formas de pagamento no período
 */
async function getResumoFormasPagamento({ dataIni, dataFim }) {
  // 6 parâmetros na SQL: 3 pares de datas (venda, devolução, etc.)
  const params = [dataIni, dataFim, dataIni, dataFim, dataIni, dataFim];
  const rows = await db.query(sqlResumoFormasPagamento, params);
  return rows;
}

/**
 * Análise por família x vendedor, com codEmpresa opcional
 */
/**
 * Análise por família x vendedor
 * @param {Object} params
 * @param {string} params.dataIni    - 'YYYY-MM-DD'
 * @param {string} params.dataFim    - 'YYYY-MM-DD'
 * @param {number|string|null} params.codEmpresa - opcional (a SQL atual não usa)
 */
async function getAnaliseFamiliaVendedor({ dataIni, dataFim /*, codEmpresa*/ }) {
  if (!sqlAnaliseFamiliaVendedor) {
    throw new Error("Arquivo analise_familia_vendedor.sql não encontrado em queries/vendas");
  }

  // A SQL espera 2 parâmetros: dataIni, dataFim
  const params = [dataIni, dataFim];

  const rows = await db.query(sqlAnaliseFamiliaVendedor, params);
  return rows;
}

module.exports = {
  getResumoEmpresaVendedor,
  getResumoFormasPagamento,
  getAnaliseFamiliaVendedor
};
