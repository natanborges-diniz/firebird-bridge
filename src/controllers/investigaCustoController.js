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

// Segunda rota: testes de performance e cobertura após sabermos os campos
async function investigarCampos(req, res) {
  if (req.headers['x-inv-token'] !== TOKEN) {
    return res.status(401).json({ ok: false });
  }

  const resultados = {};

  // A1 — sample ESTOQUE empresa 13 (campos numéricos suspeitos de custo)
  resultados.A1_estoque_sample = await run('ESTOQUE sample empresa 13',
    `SELECT FIRST 5 cod_empresa, cod_produto, saldo,
            precocusto, custoultimafatura, valortotal
     FROM estoque
     WHERE cod_empresa = 13 AND saldo > 0`);

  // A1 — cobertura precocusto na empresa 13
  resultados.A1_estoque_cobertura = await run('ESTOQUE cobertura precocusto empresa 13',
    `SELECT
       COUNT(*) AS total_skus,
       COUNT(NULLIF(precocusto, 0)) AS com_precocusto,
       COUNT(NULLIF(custoultimafatura, 0)) AS com_custoultimafatura,
       CAST(COUNT(NULLIF(precocusto, 0)) * 100.0 / NULLIF(COUNT(*), 0) AS NUMERIC(5,1)) AS pct_precocusto
     FROM estoque
     WHERE cod_empresa = 13 AND saldo > 0`);

  // A1 — performance query simples estoque empresa 1
  resultados.A1_perf_empresa1 = await run('ESTOQUE custo query empresa 1',
    `SELECT cod_produto, precocusto, custoultimafatura
     FROM estoque
     WHERE cod_empresa = 1 AND saldo > 0`,
    []);

  // A2 — sample PRODUTO com campos de custo
  resultados.A2_produto_sample = await run('PRODUTO sample custo',
    `SELECT FIRST 5 cod_produto, precocusto, precovenda
     FROM produto
     WHERE precocusto > 0`);

  return res.json({ ok: true, resultados });
}

module.exports = { investigar, investigarCampos };
