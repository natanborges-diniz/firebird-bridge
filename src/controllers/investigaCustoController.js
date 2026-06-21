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

  // A4b — schema das tabelas candidatas
  for (const tbl of ['DW$BIESTOQUE', 'V_ESTOQUE', 'MOVIMENTOESTOQUE', 'ITEMPRECO']) {
    resultados[`schema_${tbl.replace('$','_')}`] = await run(`schema ${tbl}`,
      `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
       FROM RDB$RELATION_FIELDS
       WHERE RDB$RELATION_NAME = '${tbl}'
       ORDER BY RDB$FIELD_POSITION`);
  }

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

  // A2 — sample PRODUTO (apenas 5 linhas, sem JOIN — rápido)
  resultados.A2_produto_sample_5 = await run('PRODUTO FIRST 5 com custo',
    `SELECT FIRST 5 cod_produto, precocusto, precocompra, precocustomedio, dataultimacompra
     FROM produto WHERE precocusto > 0`);

  // A2 — cobertura: COUNT somente em PRODUTO join ESTOQUE empresa 13
  resultados.A2_produto_cobertura_13 = await run('PRODUTO cobertura empresa 13',
    `SELECT COUNT(*) AS total, COUNT(NULLIF(p.precocusto,0)) AS com_custo,
            CAST(COUNT(NULLIF(p.precocusto,0))*100.0/NULLIF(COUNT(*),0) AS NUMERIC(5,1)) AS pct
     FROM estoque e JOIN produto p ON p.cod_produto = e.cod_produto
     WHERE e.cod_empresa = 13 AND e.saldo > 0`);

  // A2 — FULL JOIN: custo todos SKUs empresa 13 (medimos o tempo)
  resultados.A2_produto_full_13 = await run('PRODUTO full join empresa 13',
    `SELECT e.cod_produto, p.precocusto, p.precocustomedio, p.dataultimacompra
     FROM estoque e JOIN produto p ON p.cod_produto = e.cod_produto
     WHERE e.cod_empresa = 13 AND e.saldo > 0 ORDER BY e.cod_produto`);

  return res.json({ ok: true, resultados });
}

module.exports = { investigar, investigarCampos };
