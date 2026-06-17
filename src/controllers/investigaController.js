// src/controllers/investigaController.js
// TEMPORÁRIO — investigação Passo A (ESTOQUELOG coverage). REMOVER após coleta.

const db = require('../db');

const TOKEN = '32f9a2fa4866710ea0ca8a46a0fd74a5d857052ebb50d9a6';

function checkToken(req, res) {
  const t = req.headers['x-investiga-token'];
  if (t !== TOKEN) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return false;
  }
  return true;
}

// Q0 — colunas do ESTOQUELOG (rdb$)
async function colunasEstoquelog(req, res) {
  if (!checkToken(req, res)) return;
  try {
    const rows = await db.query(
      `SELECT TRIM(f.rdb$field_name) AS coluna
       FROM rdb$relation_fields f
       WHERE TRIM(f.rdb$relation_name) = 'ESTOQUELOG'
       ORDER BY f.rdb$field_position`,
      []
    );
    return res.json({ ok: true, data: rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// Q1 — cobertura por empresa
// 3 sub-queries + merge em JS para evitar CTEs encadeadas complexas no Firebird
async function cobertura(req, res) {
  if (!checkToken(req, res)) return;
  try {
    const [totais, comNfe, comLog] = await Promise.all([
      // Q1a: total de SKUs com saldo por empresa
      db.query(
        `SELECT e.cod_empresa, COUNT(DISTINCT e.cod_produto) AS total
         FROM estoque e
         WHERE e.cod_estoquelocal = 1 AND e.saldo > 0
         GROUP BY e.cod_empresa
         ORDER BY e.cod_empresa`,
        []
      ),
      // Q1b: SKUs com histórico de entrada tipo=2 (NFe compra) por empresa
      db.query(
        `SELECT DISTINCT t.cod_empresa, ti.cod_item AS cod_produto
         FROM transacao t
         JOIN entrada en ON en.cod_empresa = t.cod_empresa AND en.cod_entrada = t.cod_transacao
         JOIN transacao_item ti ON ti.cod_transacao = t.cod_transacao AND ti.cod_empresa = t.cod_empresa
         JOIN naturezaoperacao nat ON nat.cod_naturezaoperacao = ti.cod_naturezaoperacao
         JOIN estoque e ON e.cod_produto = ti.cod_item AND e.cod_empresa = t.cod_empresa
           AND e.cod_estoquelocal = 1 AND e.saldo > 0
         WHERE nat.tipo = 2`,
        []
      ),
      // Q1c: SKUs com precocusto > 0 via ESTOQUELOG (cod_produto existe diretamente)
      db.query(
        `SELECT DISTINCT el.cod_empresa, el.cod_produto
         FROM estoquelog el
         JOIN estoque e ON e.cod_produto = el.cod_produto AND e.cod_empresa = el.cod_empresa
           AND e.cod_estoquelocal = 1 AND e.saldo > 0
         WHERE el.precocusto > 0`,
        []
      ),
    ]);

    // Indexar por empresa
    const nfeSet = new Map(); // empresa -> Set(cod_produto)
    for (const r of comNfe) {
      const emp = r.cod_empresa ?? r.COD_EMPRESA;
      const sku = r.cod_produto ?? r.COD_PRODUTO;
      if (!nfeSet.has(emp)) nfeSet.set(emp, new Set());
      nfeSet.get(emp).add(sku);
    }

    const logSet = new Map(); // empresa -> Set(cod_produto)
    for (const r of comLog) {
      const emp = r.cod_empresa ?? r.COD_EMPRESA;
      const sku = r.cod_produto ?? r.COD_PRODUTO;
      if (!logSet.has(emp)) logSet.set(emp, new Set());
      logSet.get(emp).add(sku);
    }

    const resultado = totais.map((row) => {
      const emp = row.cod_empresa ?? row.COD_EMPRESA;
      const total = Number(row.total ?? row.TOTAL ?? 0);
      const nfe = nfeSet.get(emp);
      const log = logSet.get(emp);

      let comNfeCnt = 0;
      let semNfeComLogCnt = 0;
      let orfaosCnt = 0;

      // Para calcular sem_nfe_com_log e orfaos precisamos percorrer todos os SKUs
      // Usamos os sets para isso: mas total pode ser grande — aproveitamos as contagens diretas
      const nfeCount = nfe ? nfe.size : 0;
      const logOnlyCount = log
        ? [...log].filter((s) => !nfe || !nfe.has(s)).length
        : 0;

      comNfeCnt = nfeCount;
      semNfeComLogCnt = logOnlyCount;
      orfaosCnt = total - comNfeCnt - semNfeComLogCnt;

      const pct_recuperavel = total > 0
        ? Math.round(((comNfeCnt + semNfeComLogCnt) / total) * 100)
        : null;

      return {
        cod_empresa: emp,
        total_sku_saldo: total,
        com_nfe: comNfeCnt,
        sem_nfe_com_log: semNfeComLogCnt,
        orfaos: orfaosCnt,
        pct_recuperavel,
      };
    });

    return res.json({ ok: true, data: resultado });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, stack: err.stack });
  }
}

// Q2 — amostra: 5 SKUs da emp 18 sem NFe mas com ESTOQUELOG precocusto > 0
async function amostraEmp18(req, res) {
  if (!checkToken(req, res)) return;
  try {
    // Passo 1: pegar até 20 SKUs sem NFe
    const semNfe = await db.query(
      `SELECT FIRST 20 e.cod_produto
       FROM estoque e
       WHERE e.cod_empresa = 18 AND e.cod_estoquelocal = 1 AND e.saldo > 0
         AND NOT EXISTS (
           SELECT 1 FROM transacao t
           JOIN entrada en ON en.cod_empresa = t.cod_empresa AND en.cod_entrada = t.cod_transacao
           JOIN transacao_item ti ON ti.cod_transacao = t.cod_transacao AND ti.cod_empresa = t.cod_empresa
           JOIN naturezaoperacao nat ON nat.cod_naturezaoperacao = ti.cod_naturezaoperacao
           WHERE nat.tipo = 2 AND ti.cod_item = e.cod_produto AND t.cod_empresa = 18
         )
       ORDER BY e.cod_produto`,
      []
    );

    if (!semNfe.length) return res.json({ ok: true, data: [], note: 'nenhum SKU sem NFe em emp 18' });

    // Passo 2: para cada um, buscar custo mais recente via ESTOQUELOG
    const skus = semNfe.slice(0, 20).map((r) => r.cod_produto ?? r.COD_PRODUTO);
    const placeholders = skus.map(() => '?').join(',');

    const logRows = await db.query(
      `SELECT FIRST 20
         el.cod_empresa,
         el.cod_produto,
         el.precocusto,
         t.dataencerramento,
         t.cod_transacao,
         nat.tipo AS tipo_nao
       FROM estoquelog el
       JOIN transacao t ON t.cod_transacao = el.cod_transacao AND t.cod_empresa = el.cod_empresa
       JOIN transacao_item ti ON ti.cod_transacao = t.cod_transacao AND ti.cod_empresa = t.cod_empresa
       JOIN naturezaoperacao nat ON nat.cod_naturezaoperacao = ti.cod_naturezaoperacao
       WHERE el.cod_empresa = 18
         AND el.precocusto > 0
         AND el.cod_produto IN (${placeholders})
       ORDER BY el.cod_produto, t.dataencerramento DESC`,
      skus
    );

    // Pegar o registro mais recente por SKU
    const bySkuMap = new Map();
    for (const r of logRows) {
      const sku = r.cod_produto ?? r.COD_PRODUTO;
      if (!bySkuMap.has(sku)) bySkuMap.set(sku, r);
    }

    const amostra = [...bySkuMap.values()].slice(0, 5).map((r) => ({
      cod_sku: r.cod_produto ?? r.COD_PRODUTO,
      precocusto_log: r.precocusto ?? r.PRECOCUSTO,
      data_transacao: r.dataencerramento ?? r.DATAENCERRAMENTO,
      cod_transacao: r.cod_transacao ?? r.COD_TRANSACAO,
      tipo_nao: String(r.tipo_nao ?? r.TIPO_NAO ?? '').trim(),
    }));

    return res.json({ ok: true, data: amostra, skus_sem_nfe_testados: skus.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, stack: err.stack });
  }
}

// Q3 — mapa de naturezaoperacao.tipo (últimos 365 dias)
async function tiposNao(req, res) {
  if (!checkToken(req, res)) return;
  try {
    const rows = await db.query(
      `SELECT nat.tipo, TRIM(nat.descricao) AS descricao, COUNT(*) AS qtd_transacoes
       FROM transacao t
       JOIN transacao_item ti ON ti.cod_transacao = t.cod_transacao AND ti.cod_empresa = t.cod_empresa
       JOIN naturezaoperacao nat ON nat.cod_naturezaoperacao = ti.cod_naturezaoperacao
       WHERE t.dataencerramento >= DATEADD(-365 DAY TO CURRENT_DATE)
       GROUP BY nat.tipo, nat.descricao
       ORDER BY qtd_transacoes DESC`,
      []
    );
    return res.json({ ok: true, data: rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { colunasEstoquelog, cobertura, amostraEmp18, tiposNao };
