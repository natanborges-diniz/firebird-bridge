// src/services/vendasService.js
const path = require("path");
const fs = require("fs");
const db = require("../db"); // src/db/index.js (expõe query/runQuery)

// helper local (mesmo padrão do financeiro)
function loadSql(fileName) {
  // __dirname = /app/src/services
  // ..        = /app/src
  // ..        = /app
  // queries/vendas/fileName = /app/queries/vendas/fileName
  const filePath = path.join(__dirname, "..", "..", "queries", "vendas", fileName);
  return fs.readFileSync(filePath, "utf8");
}

// Arquivos .sql em queries/vendas
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
 * @param {Object} params
 * @param {string} params.dataIni - 'YYYY-MM-DD'
 * @param {string} params.dataFim - 'YYYY-MM-DD'
 */
async function getResumoEmpresaVendedor({ dataIni, dataFim }) {
  // Assumindo que o .sql usa:
  // where transacao.data between ? and ?
  const params = [dataIni, dataFim];
  const rows = await db.query(sqlResumoEmpresaVendedor, params);
  return rows;
}

/**
 * Resumo por formas de pagamento no período
 * @param {Object} params
 * @param {string} params.dataIni - 'YYYY-MM-DD'
 * @param {string} params.dataFim - 'YYYY-MM-DD'
 */
async function getResumoFormasPagamento({ dataIni, dataFim }) {
  // Assumindo que o .sql usa:
  // where data between ? and ? (aplicado em todos os blocos)
  const params = [dataIni, dataFim];
  const rows = await db.query(sqlResumoFormasPagamento, params);
  return rows;
}

/**
 * Análise por família x vendedor, com codEmpresa opcional
 * @param {Object} params
 * @param {string} params.dataIni     - 'YYYY-MM-DD'
 * @param {string} params.dataFim     - 'YYYY-MM-DD'
 * @param {number|string|null} params.codEmpresa - opcional; se null, traz todas
 */
async function getAnaliseFamiliaVendedor({ dataIni, dataFim, codEmpresa }) {
  if (!sqlAnaliseFamiliaVendedor) {
    throw new Error("Arquivo analise_familia_vendedor.sql não encontrado em queries/vendas");
  }

  // Convenção: o .sql deve tratar null como "todas as empresas", ex:
  // and ( ? is null or t.cod_empresa = cast(? as integer) )
  // Se você usar esse padrão, ajuste o número de ? e params.
  const params = [dataIni, dataFim, codEmpresa ?? null];
  const rows = await db.query(sqlAnaliseFamiliaVendedor, params);
  return rows;
}

module.exports = {
  getResumoEmpresaVendedor,
  getResumoFormasPagamento,
  getAnaliseFamiliaVendedor
};
