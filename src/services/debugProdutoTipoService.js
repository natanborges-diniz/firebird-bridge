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

async function mapearProdutoTipo() {
  const [produtotipoTodos, locais, classif22, samples] = await Promise.all([
    safeRun('produtotipo_dist_todos_locais', () => db.query(sqlPorEmpresa)),
    safeRun('estoquelocal_dist', () => db.query(sqlAgregado)),
    safeRun('classificacao_22_tipo', () => db.query(sqlMetaCheck)),
    safeRun('samples_5_por_produtotipo', () => db.query(sqlSamples)),
  ]);

  return {
    universo: {
      saldo_minimo: 1,
      empresas_agregadas: [1, 2, 4, 6, 9, 10, 13, 14, 15, 16, 17, 18],
      nota: 'produtotipo_dist_todos_locais e samples SEM filtro de cod_estoquelocal (universo amplo).',
    },
    produtotipo_dist_todos_locais: produtotipoTodos,
    estoquelocal_dist: locais,
    classificacao_22_tipo: classif22,
    samples_5_por_produtotipo: samples,
  };
}

module.exports = {
  mapearProdutoTipo,
};
