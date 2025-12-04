// src/services/estoqueService.js
const { runQuery } = require('../db');
const { loadSQL } = require('../utils/loadSQL');

// Carrega o SQL da analise de estoque
const analiseEstoqueSql = loadSQL('estoque/analise_estoque_acao.sql');

/**
 * Retorna analise de estoque para uma empresa (loja).
 *
 * params:
 *  - codEmpresa: numero inteiro da empresa (ex: 595)
 */
async function getAnaliseEstoqueAcao({ codEmpresa }) {
  // Nossa query tem apenas 1 "?" correspondente a cod_empresa
  const params = [codEmpresa];
  const rows = await runQuery(analiseEstoqueSql, params);
  return rows;
}

module.exports = {
  getAnaliseEstoqueAcao
};
