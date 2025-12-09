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
  // 4 parâmetros na SQL: venda_ini, venda_fim, dev_ini, dev_fim
  const params = [dataIni, dataFim, dataIni, dataFim];
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
async function getAnaliseFamiliaVendedor({ dataIni, dataFim, codEmpresa }) {
  if (!sqlAnaliseFamiliaVendedor) {
    throw new Error("Arquivo analise_familia_vendedor.sql não encontrado em queries/vendas");
  }

  // A SQL atual espera 4 parâmetros (? ? ? ?).
  // Pelo padrão dos outros relatórios, faz sentido serem 2 pares de datas
  // (ex.: vendas + devoluções). Vamos usar o mesmo intervalo para todos:
  const params = [dataIni, dataFim, dataIni, dataFim];

  // OBS: por enquanto codEmpresa NÃO está sendo usado.
  // Se depois você quiser filtrar por empresa,
  // ajustamos a SQL e este array de params.
  const rows = await db.query(sqlAnaliseFamiliaVendedor, params);
  return rows;
}

module.exports = {
  getResumoEmpresaVendedor,
  getResumoFormasPagamento,
  getAnaliseFamiliaVendedor
};
