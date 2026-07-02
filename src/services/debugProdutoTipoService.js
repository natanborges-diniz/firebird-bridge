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

async function fetchMetadata() {
  const relations = await db.query(sqlMetaCheck);
  if (!relations || relations.length === 0) {
    return { source: 'unavailable', tabela: null, rows: [] };
  }
  const nome = String(relations[0].nome || '').trim();
  if (!nome) {
    return { source: 'unavailable', tabela: null, rows: [] };
  }
  try {
    const rows = await db.query(`SELECT * FROM ${nome}`);
    return { source: 'produto_tipo_table', tabela: nome, rows };
  } catch (err) {
    return {
      source: 'error',
      tabela: nome,
      rows: [],
      error: err.message || String(err),
    };
  }
}

async function mapearProdutoTipo({ codEmpresaFoco = 13 } = {}) {
  const [porEmpresa, agregado, meta, samples] = await Promise.all([
    db.query(sqlPorEmpresa, [codEmpresaFoco]),
    db.query(sqlAgregado),
    fetchMetadata(),
    db.query(sqlSamples),
  ]);

  return {
    universo: {
      cod_estoquelocal: 1,
      saldo_minimo: 1,
      empresas_agregadas: [1, 2, 4, 6, 9, 10, 13, 14, 15, 16, 17, 18],
      empresa_foco: codEmpresaFoco,
    },
    empresa_foco: porEmpresa,
    agregado_12_lojas: agregado,
    metadata: meta,
    samples,
  };
}

module.exports = {
  mapearProdutoTipo,
};
