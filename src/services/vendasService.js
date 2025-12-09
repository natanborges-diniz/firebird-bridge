// src/services/vendasService.js
const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js (expõe query/runQuery)

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
  const params = [dataIni, dataFim, dataIni, dataFim];
  const rows = await db.query(sqlResumoEmpresaVendedor, params);
  return rows;
}

/**
 * Resumo por formas de pagamento no período
 */
async function getResumoFormasPagamento({ dataIni, dataFim }) {
  const params = [dataIni, dataFim, dataIni, dataFim];
  const rows = await db.query(sqlResumoFormasPagamento, params);
  return rows;
}

/**
 * Análise por família x vendedor, com codEmpresa opcional
 */
async function getAnaliseFamiliaVendedor({ dataIni, dataFim, codEmpresa }) {
  if (!sqlAnaliseFamiliaVendedor) {
    throw new Error("Arquivo analise_familia_vendedor.sql não encontrado em queries/vendas");
  }

  // Ajuste aqui conforme a quantidade de "?" no analise_familia_vendedor.sql
  const params = [dataIni, dataFim, codEmpresa ?? null];
  const rows = await db.query(sqlAnaliseFamiliaVendedor, params);
  return rows;
}

module.exports = {
  getResumoEmpresaVendedor,
  getResumoFormasPagamento,
  getAnaliseFamiliaVendedor
};
