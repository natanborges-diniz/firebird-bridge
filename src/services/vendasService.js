// src/services/vendasService.js
const { runQuery } = require('../db');
const { loadSQL } = require('../utils/loadSQL');

// SQL de resumo por empresa/vendedor (já existia)
const resumoSql = loadSQL('vendas/resumo_empresa_vendedor.sql');

// NOVO: SQL de formas de pagamento
const formasPagamentoSql = loadSQL('vendas/formas_pagamento_resumo.sql');

async function getResumoEmpresaVendedor({ dataInicio, dataFim }) {
  // sua query tem 4 "?" (2 para vendas + 2 para devolução)
  const params = [dataInicio, dataFim, dataInicio, dataFim];
  const rows = await runQuery(resumoSql, params);
  return rows;
}

async function getResumoFormasPagamento({ dataInicio, dataFim }) {
  // nossa query tem 6 "?" (2 + 2 + 2)
  const params = [
    dataInicio, dataFim, // bloco principal
    dataInicio, dataFim, // convênio
    dataInicio, dataFim  // devolução
  ];
  const rows = await runQuery(formasPagamentoSql, params);
  return rows;
}

module.exports = {
  getResumoEmpresaVendedor,
  getResumoFormasPagamento
};
