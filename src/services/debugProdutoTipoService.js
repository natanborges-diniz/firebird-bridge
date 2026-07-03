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
  const [schemaProduto, schemaItem, classificacoes, caboSample] = await Promise.all([
    safeRun('schema_produto', () => db.query(sqlPorEmpresa)),
    safeRun('schema_item', () => db.query(sqlAgregado)),
    safeRun('classificacoes', () => db.query(sqlMetaCheck)),
    safeRun('cabo_pp_sample', () => db.query(sqlSamples)),
  ]);

  return {
    nota:
      'PRODUTO.COD_PRODUTO_TIPO nao existe. Consultas trocadas por introspecao ' +
      'de schema (colunas de PRODUTO/ITEM), listagem de dwitemclassificacao e ' +
      'busca do SKU "CABO PP" pra revelar qual classificacao separa revenda x insumo.',
    schema_produto: schemaProduto,
    schema_item: schemaItem,
    classificacoes: classificacoes,
    cabo_pp_sample: caboSample,
  };
}

module.exports = {
  mapearProdutoTipo,
};
