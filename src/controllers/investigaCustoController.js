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

// Rota A — schema das tabelas (metadados apenas, sem scan de dados)
async function investigar(req, res) {
  if (req.headers['x-inv-token'] !== TOKEN) {
    return res.status(401).json({ ok: false });
  }

  const resultados = {};

  resultados.A1_campos_estoque = await run('campos ESTOQUE',
    `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
     FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'ESTOQUE' ORDER BY RDB$FIELD_POSITION`);

  resultados.A2a_campos_produto = await run('campos PRODUTO',
    `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
     FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'PRODUTO' ORDER BY RDB$FIELD_POSITION`);

  resultados.A2b_campos_item = await run('campos ITEM',
    `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
     FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'ITEM' ORDER BY RDB$FIELD_POSITION`);

  resultados.A4_tabelas = await run('tabelas custo/estoque/preco',
    `SELECT TRIM(RDB$RELATION_NAME) AS tabela, RDB$RELATION_TYPE AS tipo
     FROM RDB$RELATIONS
     WHERE (RDB$RELATION_NAME LIKE '%CUSTO%' OR RDB$RELATION_NAME LIKE '%ESTOQUE%'
         OR RDB$RELATION_NAME LIKE '%PRECO%') AND RDB$SYSTEM_FLAG = 0
     ORDER BY RDB$RELATION_NAME`);

  for (const tbl of ['DW$BIESTOQUE', 'V_ESTOQUE', 'MOVIMENTOESTOQUE', 'ITEMPRECO']) {
    resultados[`schema_${tbl.replace('$', '_')}`] = await run(`schema ${tbl}`,
      `SELECT TRIM(RDB$FIELD_NAME) AS campo, RDB$FIELD_POSITION AS pos
       FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = '${tbl}' ORDER BY RDB$FIELD_POSITION`);
  }

  return res.json({ ok: true, resultados });
}

// Rota B — PRODUTO (global, custo cadastral)
async function investigarProduto(req, res) {
  if (req.headers['x-inv-token'] !== TOKEN) return res.status(401).json({ ok: false });
  const resultados = {};
  resultados.sample = await run('PRODUTO FIRST 5',
    `SELECT FIRST 5 cod_produto, precocusto, precocompra, precocustomedio, dataultimacompra
     FROM produto WHERE precocusto > 0`);
  resultados.cobertura_13 = await run('PRODUTO cobertura empresa 13',
    `SELECT COUNT(*) AS total, COUNT(NULLIF(p.precocusto,0)) AS com_custo,
            CAST(COUNT(NULLIF(p.precocusto,0))*100.0/NULLIF(COUNT(*),0) AS NUMERIC(5,1)) AS pct
     FROM estoque e JOIN produto p ON p.cod_produto = e.cod_produto
     WHERE e.cod_empresa = 13 AND e.saldo > 0`);
  resultados.full_13 = await run('PRODUTO full empresa 13',
    `SELECT e.cod_produto, p.precocusto, p.precocustomedio, p.dataultimacompra
     FROM estoque e JOIN produto p ON p.cod_produto = e.cod_produto
     WHERE e.cod_empresa = 13 AND e.saldo > 0 ORDER BY e.cod_produto`);
  return res.json({ ok: true, fonte: 'PRODUTO', resultados });
}

// Rota C — ITEMPRECO (por empresa — candidato principal)
async function investigarItemPreco(req, res) {
  if (req.headers['x-inv-token'] !== TOKEN) return res.status(401).json({ ok: false });
  const resultados = {};
  resultados.sample = await run('ITEMPRECO sample empresa 13',
    `SELECT FIRST 5 cod_item, cod_empresa, precocusto, precocompra, precocustomedio, ultimaalteracao
     FROM itempreco WHERE cod_empresa = 13 AND precocusto > 0`);
  resultados.full_13 = await run('ITEMPRECO full join estoque empresa 13',
    `SELECT e.cod_produto, ip.precocusto, ip.precocustomedio, ip.ultimaalteracao
     FROM estoque e
     JOIN itempreco ip ON ip.cod_item = e.cod_produto AND ip.cod_empresa = e.cod_empresa
     WHERE e.cod_empresa = 13 AND e.saldo > 0 ORDER BY e.cod_produto`);
  resultados.cobertura_13 = await run('ITEMPRECO cobertura empresa 13',
    `SELECT COUNT(*) AS total_skus,
            SUM(CASE WHEN ip.cod_item IS NOT NULL THEN 1 ELSE 0 END) AS tem_itempreco,
            SUM(CASE WHEN ip.precocusto > 0 THEN 1 ELSE 0 END) AS com_custo,
            CAST(SUM(CASE WHEN ip.precocusto > 0 THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0) AS NUMERIC(5,1)) AS pct
     FROM estoque e
     LEFT JOIN itempreco ip ON ip.cod_item = e.cod_produto AND ip.cod_empresa = e.cod_empresa
     WHERE e.cod_empresa = 13 AND e.saldo > 0`);
  return res.json({ ok: true, fonte: 'ITEMPRECO', resultados });
}

// Rota D — MOVIMENTOESTOQUE (separado: pode ser lento)
async function investigarMovimentoEstoque(req, res) {
  if (req.headers['x-inv-token'] !== TOKEN) return res.status(401).json({ ok: false });
  const resultados = {};
  resultados.sample = await run('MOVIMENTOESTOQUE sample empresa 13',
    `SELECT FIRST 5 cod_produto, cod_empresa, data, precocusto, cod_movimentoestoquetipo
     FROM movimentoestoque WHERE cod_empresa = 13 AND precocusto > 0 ORDER BY data DESC`);
  resultados.count_13 = await run('MOVIMENTOESTOQUE count empresa 13',
    `SELECT COUNT(*) AS total FROM movimentoestoque WHERE cod_empresa = 13 AND precocusto > 0`);
  resultados.ultimo_por_sku = await run('MOVIMENTOESTOQUE ultimo custo por SKU empresa 13',
    `SELECT me.cod_produto, me.precocusto, me.data
     FROM movimentoestoque me
     JOIN (SELECT cod_produto, MAX(cod_movimentoestoque) AS max_id
           FROM movimentoestoque WHERE cod_empresa = 13 AND precocusto > 0
           GROUP BY cod_produto) mx ON mx.max_id = me.cod_movimentoestoque
     JOIN estoque e ON e.cod_produto = me.cod_produto AND e.cod_empresa = 13
     WHERE e.saldo > 0 ORDER BY me.cod_produto`);
  return res.json({ ok: true, fonte: 'MOVIMENTOESTOQUE', resultados });
}

// alias rota antiga
async function investigarCampos(req, res) { return investigarItemPreco(req, res); }

// Rota Q — query única por nome (para isolar performance de cada query)
const QUERIES = {
  ip_sample:  `SELECT FIRST 5 cod_item, cod_empresa, precocusto, precocustomedio, ultimaalteracao FROM itempreco WHERE cod_empresa = 13 AND precocusto > 0`,
  ip_full:    `SELECT e.cod_produto, ip.precocusto, ip.precocustomedio, ip.ultimaalteracao FROM estoque e JOIN itempreco ip ON ip.cod_item = e.cod_produto AND ip.cod_empresa = e.cod_empresa WHERE e.cod_empresa = 13 AND e.saldo > 0 ORDER BY e.cod_produto`,
  ip_cob:     `SELECT COUNT(*) AS total, SUM(CASE WHEN ip.cod_item IS NOT NULL THEN 1 ELSE 0 END) AS tem_ip, SUM(CASE WHEN ip.precocusto > 0 THEN 1 ELSE 0 END) AS com_custo FROM estoque e LEFT JOIN itempreco ip ON ip.cod_item = e.cod_produto AND ip.cod_empresa = e.cod_empresa WHERE e.cod_empresa = 13 AND e.saldo > 0`,
  me_sample:  `SELECT FIRST 5 cod_produto, data, precocusto, cod_movimentoestoquetipo FROM movimentoestoque WHERE cod_empresa = 13 AND precocusto > 0 ORDER BY data DESC`,
  me_count:   `SELECT COUNT(*) AS total FROM movimentoestoque WHERE cod_empresa = 13 AND precocusto > 0`,
  me_ultimo:  `SELECT me.cod_produto, me.precocusto, me.data FROM movimentoestoque me JOIN (SELECT cod_produto, MAX(cod_movimentoestoque) AS max_id FROM movimentoestoque WHERE cod_empresa = 13 AND precocusto > 0 GROUP BY cod_produto) mx ON mx.max_id = me.cod_movimentoestoque JOIN estoque e ON e.cod_produto = me.cod_produto AND e.cod_empresa = 13 WHERE e.saldo > 0 ORDER BY me.cod_produto`,
  prod_cob:   `SELECT COUNT(*) AS total, COUNT(NULLIF(p.precocusto,0)) AS com_custo, CAST(COUNT(NULLIF(p.precocusto,0))*100.0/NULLIF(COUNT(*),0) AS NUMERIC(5,1)) AS pct FROM estoque e JOIN produto p ON p.cod_produto = e.cod_produto WHERE e.cod_empresa = 13 AND e.saldo > 0`,
  prod_full:  `SELECT e.cod_produto, p.precocusto, p.precocustomedio, p.dataultimacompra FROM estoque e JOIN produto p ON p.cod_produto = e.cod_produto WHERE e.cod_empresa = 13 AND e.saldo > 0 ORDER BY e.cod_produto`,
};

async function investigarQ(req, res) {
  if (req.headers['x-inv-token'] !== TOKEN) return res.status(401).json({ ok: false });
  const q = req.query.q;
  if (!q || !QUERIES[q]) return res.status(400).json({ ok: false, disponiveis: Object.keys(QUERIES) });
  const resultado = await run(q, QUERIES[q]);
  return res.json({ ok: true, resultado });
}

module.exports = { investigar, investigarCampos, investigarProduto, investigarItemPreco, investigarMovimentoEstoque, investigarQ };
