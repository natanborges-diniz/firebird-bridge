// TEMPORÁRIO — investigação de fontes de custo. Remover após coleta.
const db = require('../db');

const TOKEN = 'inv-custo-2026';

async function run(label, sql, params = []) {
  const t0 = Date.now();
  try {
    const rows = await db.query(sql, params);
    return { label, ms: Date.now() - t0, rows };
  } catch (err) {
    return { label, ms: Date.now() - t0, erro: err.message };
  }
}

async function investigar(req, res) {
  if (req.headers['x-inv-token'] !== TOKEN) {
    return res.status(401).json({ ok: false });
  }

  const resultados = {};

  // A1 — todos campos da tabela ESTOQUE
  resultados.A1_campos_estoque = await run('campos ESTOQUE',
    `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
     FROM RDB$RELATION_FIELDS
     WHERE RDB$RELATION_NAME = 'ESTOQUE'
     ORDER BY RDB$FIELD_POSITION`);

  // A2a — todos campos de PRODUTO
  resultados.A2a_campos_produto = await run('campos PRODUTO',
    `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
     FROM RDB$RELATION_FIELDS
     WHERE RDB$RELATION_NAME = 'PRODUTO'
     ORDER BY RDB$FIELD_POSITION`);

  // A2b — todos campos de ITEM
  resultados.A2b_campos_item = await run('campos ITEM',
    `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
     FROM RDB$RELATION_FIELDS
     WHERE RDB$RELATION_NAME = 'ITEM'
     ORDER BY RDB$FIELD_POSITION`);

  // A4 — tabelas com CUSTO, ESTOQUE, PRECO no nome
  resultados.A4_tabelas = await run('tabelas custo/estoque/preco',
    `SELECT TRIM(RDB$RELATION_NAME) AS tabela, RDB$RELATION_TYPE AS tipo
     FROM RDB$RELATIONS
     WHERE (RDB$RELATION_NAME LIKE '%CUSTO%'
         OR RDB$RELATION_NAME LIKE '%ESTOQUE%'
         OR RDB$RELATION_NAME LIKE '%PRECO%')
       AND RDB$SYSTEM_FLAG = 0
     ORDER BY RDB$RELATION_NAME`);

  return res.json({ ok: true, resultados });
}

// Segunda rota: testes de performance e cobertura — candidatos confirmados
async function investigarCampos(req, res) {
  if (req.headers['x-inv-token'] !== TOKEN) {
    return res.status(401).json({ ok: false });
  }

  const resultados = {};

  // A2 — schema PRODUTO (campos de custo confirmados na rota anterior)
  resultados.A2_produto_sample = await run('PRODUTO sample custo (campos reais)',
    `SELECT FIRST 5 cod_produto, precocusto, precocompra, precocustomedio, dataultimacompra
     FROM produto
     WHERE precocusto > 0`);

  // A2 — cobertura de custo em PRODUTO (join com estoque empresa 13)
  resultados.A2_produto_cobertura_13 = await run('PRODUTO cobertura custo empresa 13',
    `SELECT
       COUNT(*) AS total_skus,
       COUNT(NULLIF(p.precocusto, 0)) AS com_precocusto,
       COUNT(NULLIF(p.precocompra, 0)) AS com_precocompra,
       COUNT(NULLIF(p.precocustomedio, 0)) AS com_customedio,
       CAST(COUNT(NULLIF(p.precocusto, 0)) * 100.0 / NULLIF(COUNT(*), 0) AS NUMERIC(5,1)) AS pct_precocusto
     FROM estoque e
     JOIN produto p ON p.cod_produto = e.cod_produto
     WHERE e.cod_empresa = 13 AND e.saldo > 0`);

  // A2 — performance: custo de todos os SKUs empresa 13 via PRODUTO (deve ser <1s)
  resultados.A2_produto_perf_13 = await run('PRODUTO custo todos SKUs empresa 13',
    `SELECT e.cod_produto, p.precocusto, p.precocompra, p.precocustomedio, p.dataultimacompra
     FROM estoque e
     JOIN produto p ON p.cod_produto = e.cod_produto
     WHERE e.cod_empresa = 13 AND e.saldo > 0
     ORDER BY e.cod_produto`);

  // A4b — schema DW$BIESTOQUE (candidato BI)
  resultados.A4b_dwbiestoque_schema = await run('DW$BIESTOQUE campos',
    `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
     FROM RDB$RELATION_FIELDS
     WHERE RDB$RELATION_NAME = 'DW$BIESTOQUE'
     ORDER BY RDB$FIELD_POSITION`);

  // A4b — schema V_ESTOQUE (view)
  resultados.A4b_vestoque_schema = await run('V_ESTOQUE campos',
    `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
     FROM RDB$RELATION_FIELDS
     WHERE RDB$RELATION_NAME = 'V_ESTOQUE'
     ORDER BY RDB$FIELD_POSITION`);

  // A4b — schema MOVIMENTOESTOQUE
  resultados.A4b_movimentoestoque_schema = await run('MOVIMENTOESTOQUE campos',
    `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
     FROM RDB$RELATION_FIELDS
     WHERE RDB$RELATION_NAME = 'MOVIMENTOESTOQUE'
     ORDER BY RDB$FIELD_POSITION`);

  return res.json({ ok: true, resultados });
}

module.exports = { investigar, investigarCampos };
