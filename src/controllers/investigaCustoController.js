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

  // --- ITEMPRECO: tabela por empresa (maior candidato) ---

  // Sample ITEMPRECO empresa 13
  resultados.IP_sample = await run('ITEMPRECO sample empresa 13',
    `SELECT FIRST 5 cod_item, cod_empresa, precocusto, precocompra, precocustomedio, ultimaalteracao
     FROM itempreco WHERE cod_empresa = 13 AND precocusto > 0`);

  // ITEMPRECO: todos os SKUs em estoque empresa 13 (join + filtro custo)
  resultados.IP_full_13 = await run('ITEMPRECO full join estoque empresa 13',
    `SELECT e.cod_produto, ip.precocusto, ip.precocustomedio, ip.ultimaalteracao
     FROM estoque e
     JOIN itempreco ip ON ip.cod_item = e.cod_produto AND ip.cod_empresa = e.cod_empresa
     WHERE e.cod_empresa = 13 AND e.saldo > 0
     ORDER BY e.cod_produto`);

  // ITEMPRECO: cobertura empresa 13
  resultados.IP_cobertura_13 = await run('ITEMPRECO cobertura empresa 13',
    `SELECT COUNT(*) AS total_skus_estoque,
            SUM(CASE WHEN ip.cod_item IS NOT NULL THEN 1 ELSE 0 END) AS tem_itempreco,
            SUM(CASE WHEN ip.precocusto > 0 THEN 1 ELSE 0 END) AS com_custo_preenchido,
            CAST(SUM(CASE WHEN ip.precocusto > 0 THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0) AS NUMERIC(5,1)) AS pct_custo
     FROM estoque e
     LEFT JOIN itempreco ip ON ip.cod_item = e.cod_produto AND ip.cod_empresa = e.cod_empresa
     WHERE e.cod_empresa = 13 AND e.saldo > 0`);

  // --- MOVIMENTOESTOQUE: custo por movimento ---

  // Sample MOVIMENTOESTOQUE empresa 13
  resultados.ME_sample = await run('MOVIMENTOESTOQUE sample empresa 13',
    `SELECT FIRST 5 cod_produto, cod_empresa, data, precocusto, cod_movimentoestoquetipo
     FROM movimentoestoque WHERE cod_empresa = 13 AND precocusto > 0
     ORDER BY data DESC`);

  // MOVIMENTOESTOQUE: custo mais recente por SKU empresa 13
  resultados.ME_ultimo_por_sku = await run('MOVIMENTOESTOQUE ultimo custo empresa 13',
    `SELECT me.cod_produto, me.precocusto, me.data
     FROM movimentoestoque me
     JOIN (
       SELECT cod_produto, MAX(cod_movimentoestoque) AS max_id
       FROM movimentoestoque
       WHERE cod_empresa = 13 AND precocusto > 0
       GROUP BY cod_produto
     ) mx ON mx.max_id = me.cod_movimentoestoque
     JOIN estoque e ON e.cod_produto = me.cod_produto AND e.cod_empresa = 13
     WHERE e.saldo > 0
     ORDER BY me.cod_produto`);

  return res.json({ ok: true, resultados });
}

module.exports = { investigar, investigarCampos };
