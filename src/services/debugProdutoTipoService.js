// src/services/debugProdutoTipoService.js
// [INVESTIGACAO/TEMPORARIO] Mapeia cod_produto_tipo em estoque das 12 lojas
// Diniz. Decisao pendente: quais tipos filtrar do sync (insumo x revenda).
// Sem escritas, sem impacto em sync. Remover apos decisao do stakeholder.
const path = require('path');
const fs = require('fs');
const db = require('../db');

function loadSql(fileName) {
  const filePath = path.join(__dirname, '..', '..', 'queries', 'debug', fileName);
  return fs.readFileSync(filePath, 'utf8');
}

const sqlPorEmpresa   = loadSql('produto_tipo_por_empresa.sql');
const sqlAgregado     = loadSql('produto_tipo_agregado.sql');
const sqlMetaCheck    = loadSql('produto_tipo_meta_check.sql');
const sqlSamples      = loadSql('produto_tipo_samples.sql');

async function safeRun(label, fn) {
  const t0 = Date.now();
  try {
    const rows = await fn();
    return { label, ok: true, ms: Date.now() - t0, rows };
  } catch (err) {
    return {
      label,
      ok: false,
      ms: Date.now() - t0,
      error: err.message || String(err),
    };
  }
}

async function distProdutotipo() {
  return safeRun('produtotipo_dist_todos_locais', () => db.query(sqlPorEmpresa));
}
async function distEstoqueLocal() {
  return safeRun('estoquelocal_dist', () => db.query(sqlAgregado));
}
async function distClassificacao22() {
  return safeRun('classificacao_22_tipo', () => db.query(sqlMetaCheck));
}
async function samplesPorProdutotipo() {
  return safeRun('samples_5_por_produtotipo', () => db.query(sqlSamples));
}

module.exports = {
  distProdutotipo,
  distEstoqueLocal,
  distClassificacao22,
  samplesPorProdutotipo,
};
