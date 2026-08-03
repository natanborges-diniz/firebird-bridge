-- queries/vendas/resumo_diario_simples.sql
-- Resumo diário simples com rateio por forma de pagamento
-- Parâmetros (13):
--   1) empresa (int) - empresa ou empresa estoque
--   2) empresa (int) - empresa ou empresa estoque (mesmo valor)
--   3) dataInicio (date) - vendas (DATAEMISSAO)
--   4) dataFim (date)    - vendas (DATAEMISSAO)
--   5) excluirCreditos (int: 0/1) - remove só as linhas de crédito (tipo 6)
--      após o rateio, sem redistribuir o valor entre as outras formas
--   6) dataInicio (date) - convenio (DATAEMISSAO)
--   7) dataFim (date)    - convenio (DATAEMISSAO)
--   8) empresa (int)     - convenio empresa estoque
--   9) empresa (int)     - convenio empresa
--  10) dataInicio (date) - devolucao (DATAENCERRAMENTO)
--  11) dataFim (date)    - devolucao (DATAENCERRAMENTO)
--  12) empresa (int)     - devolucao empresa estoque
--  13) empresa (int)     - devolucao empresa

WITH
transacoes_base AS (
  SELECT
    t.cod_transacao,
    t.cod_empresaestoque,
    t.cod_empresa,
    t.dataemissao,
    t.cod_faturatransacao,
    s.cod_vendedor
  FROM transacao t
  JOIN naturezaoperacao nat ON nat.cod_naturezaoperacao = t.cod_naturezaoperacao
  LEFT JOIN saida s
    ON s.cod_saida = t.cod_transacao
   AND (
     s.cod_empresa = t.cod_empresaestoque
     OR (t.cod_empresa IS NOT NULL AND s.cod_empresa = t.cod_empresa)
   )
  WHERE nat.tipo = 1
    AND (t.cod_empresaestoque = ? OR t.cod_empresa = ?)
    AND t.dataemissao BETWEEN ? AND ?
    /*__FILTRO_VENDA_REGULAR__*/
),
itens_agregados AS (
  SELECT
    tb.cod_transacao,
    tb.cod_empresaestoque AS cod_empresa,
    SUM(
      CAST(COALESCE(ti.valororiginal, 0) AS DOUBLE PRECISION)
      * CAST(COALESCE(ti.quantidade, 0) AS DOUBLE PRECISION)
    ) AS total_bruto,
    SUM(
      CAST(COALESCE(ti.total, 0) AS DOUBLE PRECISION)
      - CAST(COALESCE(ti.valordesconto, 0) AS DOUBLE PRECISION)
      - CAST(COALESCE(ti.totalipi, 0) AS DOUBLE PRECISION)
    ) AS total_vendido
  FROM transacao_item ti
  JOIN transacoes_base tb
    ON tb.cod_transacao = ti.cod_transacao
   AND (
     ti.cod_empresa = tb.cod_empresaestoque
     OR (tb.cod_empresa IS NOT NULL AND ti.cod_empresa = tb.cod_empresa)
   )
  GROUP BY
    tb.cod_transacao,
    tb.cod_empresaestoque
),
/* ATENCAO (aferido 2026-08): em venda com N transacoes na MESMA fatura, cada
   transacao recebe as parcelas integrais da fatura. TOTAL_VENDIDO continua
   correto (itens x proporcao normalizada por transacao), mas TOTAL_PAGO_FORMA
   duplica nesses casos — nao usar TOTAL_PAGO_FORMA como faturamento. O cache
   vendas_agregado_diario grava apenas TOTAL_VENDIDO. */
parcelas_agregadas AS (
  SELECT
    tb.cod_transacao,
    tb.cod_empresaestoque AS cod_empresa,
    fp.cod_formapagamentotipo,
    cct.credito,
    /* SALDO A RECEBER congelado como NO ATO da venda (Natan, 2026-08-03):
       a bandeira interna em aberto E a parcela de quitacao (venc <> venc
       original, que ganha a bandeira real do cartao usado) contam como a
       categoria 'SALDO A RECEBER' — o dashboard mostra como a venda foi
       FINALIZADA, nunca os recebimentos posteriores do saldo. */
    CASE
      WHEN fp.cod_formapagamentotipo = 3 AND (
        UPPER(TRIM(COALESCE(cct.nome, ''))) = 'SALDO A RECEBER'
        OR (flp.datavencimentooriginal IS NOT NULL
            AND flp.datavencimento <> flp.datavencimentooriginal)
      ) THEN 1 ELSE 0
    END AS eh_saldo,
    SUM(
      CAST(
        COALESCE(
          IIF(flp.datapagamento IS NULL, flp.valor, flp.valorpago),
          0
        ) AS DOUBLE PRECISION
      )
    ) AS total_pago
  FROM transacoes_base tb
  LEFT JOIN finfaturatransacao fft ON fft.cod_faturatransacao = tb.cod_faturatransacao
  LEFT JOIN finlancamento fl ON fl.cod_faturatransacao = fft.cod_faturatransacao
  LEFT JOIN finlancamentoparcela flp ON flp.cod_lancamento = fl.cod_lancamento
  LEFT JOIN finformapagamento fp ON fp.cod_formapagamento = flp.cod_formapagamento
  LEFT JOIN finformapagamentocartao fpc ON fpc.cod_formapagamentocartao = fp.cod_formapagamento
  LEFT JOIN fincartaocreditotipo cct ON cct.cod_cartaocreditotipo = fpc.cod_cartaocreditotipo
  GROUP BY
    tb.cod_transacao,
    tb.cod_empresaestoque,
    fp.cod_formapagamentotipo,
    cct.credito,
    CASE
      WHEN fp.cod_formapagamentotipo = 3 AND (
        UPPER(TRIM(COALESCE(cct.nome, ''))) = 'SALDO A RECEBER'
        OR (flp.datavencimentooriginal IS NOT NULL
            AND flp.datavencimento <> flp.datavencimentooriginal)
      ) THEN 1 ELSE 0
    END
),
parcelas_com_proporcao AS (
  SELECT
    pa.*,
    pa.total_pago / NULLIF(
      SUM(pa.total_pago) OVER (PARTITION BY pa.cod_transacao, pa.cod_empresa),
      0
    ) AS proporcao
  FROM parcelas_agregadas pa
),
/* excluirCreditos — semantica unica (D4): remove apenas as linhas de credito
   (cod_formapagamentotipo = 6) DEPOIS do calculo do rateio. O valor dos
   creditos NAO e redistribuido entre as outras formas de pagamento. */
parcelas_filtradas AS (
  SELECT pp.*
  FROM parcelas_com_proporcao pp
  WHERE (? = 0 OR pp.cod_formapagamentotipo <> 6 OR pp.cod_formapagamentotipo IS NULL)
),
/* ------------------------------------------------------------------
   CONVENIO — pré-agregação por transação (D6): itens e parcelas são
   agregados separadamente antes do join, evitando o produto cartesiano
   parcela × item que multiplicava os totais.
   -- TODO: validar natureza (bloco sem filtro nat.tipo = 1; semantica incerta)
   ------------------------------------------------------------------ */
convenio_base AS (
  SELECT
    t.cod_transacao,
    t.cod_empresaestoque,
    t.cod_empresa,
    t.dataemissao
  FROM transacao t
  WHERE t.dataemissao BETWEEN ? AND ?
    AND (t.cod_empresaestoque = ? OR t.cod_empresa = ?)
    AND EXISTS (
      SELECT 1
      FROM transacaoconvenioparcela cp
      WHERE cp.cod_transacao = t.cod_transacao
        AND cp.cod_empresa = t.cod_empresa
    )
),
convenio_itens AS (
  SELECT
    cb.cod_transacao,
    cb.cod_empresaestoque AS cod_empresa,
    SUM(
      CAST(COALESCE(ti.valororiginal, 0) AS DOUBLE PRECISION)
      * CAST(COALESCE(ti.quantidade, 0) AS DOUBLE PRECISION)
    ) AS total_bruto,
    SUM(
      CAST(COALESCE(ti.total, 0) AS DOUBLE PRECISION)
      - CAST(COALESCE(ti.valordesconto, 0) AS DOUBLE PRECISION)
      - CAST(COALESCE(ti.totalipi, 0) AS DOUBLE PRECISION)
    ) AS total_vendido
  FROM transacao_item ti
  JOIN convenio_base cb
    ON cb.cod_transacao = ti.cod_transacao
   AND (
     ti.cod_empresa = cb.cod_empresaestoque
     OR (cb.cod_empresa IS NOT NULL AND ti.cod_empresa = cb.cod_empresa)
   )
  GROUP BY
    cb.cod_transacao,
    cb.cod_empresaestoque
),
convenio_parcelas AS (
  SELECT
    cb.cod_transacao,
    cb.cod_empresaestoque AS cod_empresa,
    SUM(CAST(COALESCE(cp.valor, 0) AS DOUBLE PRECISION)) AS total_convenio
  FROM transacaoconvenioparcela cp
  JOIN convenio_base cb
    ON cb.cod_transacao = cp.cod_transacao
   AND cb.cod_empresa = cp.cod_empresa
  GROUP BY
    cb.cod_transacao,
    cb.cod_empresaestoque
),
/* ------------------------------------------------------------------
   DEVOLUCAO — pré-agregação por transação (D6): itens agregados antes
   do join; o total da devolução vem direto de transacao.total (uma
   linha por transação), sem multiplicar pelo nº de itens.
   -- TODO: validar natureza (bloco sem filtro nat.tipo; semantica incerta)
   Obs (D7/D4): excluirCreditos NÃO se aplica aqui — a semantica unica
   remove apenas linhas de forma de pagamento tipo 6, e o bloco de
   devolução não possui linhas de forma de pagamento.
   ------------------------------------------------------------------ */
devolucao_base AS (
  SELECT
    t.cod_transacao,
    t.cod_empresaestoque,
    t.cod_empresa,
    t.dataencerramento,
    t.total,
    e.cod_vendedor
  FROM transacao t
  JOIN entradanotafiscaldevolucao e
    ON t.cod_transacao = e.cod_entradanotafiscaldevolucao
   AND t.cod_empresa = e.cod_empresa
  WHERE t.dataencerramento BETWEEN ? AND ?
    AND (t.cod_empresaestoque = ? OR t.cod_empresa = ?)
),
devolucao_itens AS (
  SELECT
    dvb.cod_transacao,
    dvb.cod_empresaestoque AS cod_empresa,
    SUM(
      CAST(COALESCE(ti.valororiginal, 0) AS DOUBLE PRECISION)
      * CAST(COALESCE(ti.quantidade, 0) AS DOUBLE PRECISION)
    ) AS total_bruto,
    SUM(
      CAST(COALESCE(ti.total, 0) AS DOUBLE PRECISION)
      - CAST(COALESCE(ti.valordesconto, 0) AS DOUBLE PRECISION)
      - CAST(COALESCE(ti.totalipi, 0) AS DOUBLE PRECISION)
    ) AS total_vendido
  FROM transacao_item ti
  JOIN devolucao_base dvb
    ON dvb.cod_transacao = ti.cod_transacao
   AND (
     ti.cod_empresa = dvb.cod_empresaestoque
     OR (dvb.cod_empresa IS NOT NULL AND ti.cod_empresa = dvb.cod_empresa)
   )
  GROUP BY
    dvb.cod_transacao,
    dvb.cod_empresaestoque
)

SELECT
  tb.dataemissao AS DATA_VENDA,
  tb.cod_empresaestoque AS COD_EMPRESA,
  COALESCE(v.nome, 'SEM VENDEDOR') AS VENDEDOR,
  CASE
    WHEN pp.eh_saldo = 1 THEN 'SALDO A RECEBER'
    WHEN pp.cod_formapagamentotipo = 1 THEN 'DINHEIRO'
    WHEN pp.cod_formapagamentotipo = 2 THEN 'CHEQUE'
    WHEN pp.cod_formapagamentotipo = 3 THEN
      CASE
        WHEN pp.credito = 'T' THEN 'CARTAO CREDITO'
        ELSE 'CARTAO DEBITO'
      END
    WHEN pp.cod_formapagamentotipo = 4 THEN 'BANCO'
    WHEN pp.cod_formapagamentotipo = 5 THEN 'CARNE'
    WHEN pp.cod_formapagamentotipo = 6 THEN 'CREDITOS'
    ELSE 'OUTROS'
  END AS FORMAPAGAMENTO,
  COUNT(DISTINCT tb.cod_transacao || '-' || tb.cod_empresaestoque) AS QTD_VENDAS,
  SUM(COALESCE(ia.total_bruto, 0) * COALESCE(pp.proporcao, 1)) AS TOTAL_BRUTO,
  SUM(COALESCE(ia.total_vendido, 0) * COALESCE(pp.proporcao, 1)) AS TOTAL_VENDIDO,
  SUM(
    (COALESCE(ia.total_bruto, 0) - COALESCE(ia.total_vendido, 0))
    * COALESCE(pp.proporcao, 1)
  ) AS TOTAL_DESCONTO,
  SUM(pp.total_pago) AS TOTAL_PAGO_FORMA
FROM transacoes_base tb
LEFT JOIN pessoa v ON v.cod_pessoa = tb.cod_vendedor
JOIN itens_agregados ia
  ON ia.cod_transacao = tb.cod_transacao
 AND tb.cod_empresaestoque = ia.cod_empresa
JOIN parcelas_filtradas pp
  ON pp.cod_transacao = tb.cod_transacao
 AND pp.cod_empresa = tb.cod_empresaestoque
GROUP BY
  tb.dataemissao,
  tb.cod_empresaestoque,
  v.nome,
  FORMAPAGAMENTO

UNION ALL

SELECT
  cb.dataemissao AS DATA_VENDA,
  cb.cod_empresaestoque AS COD_EMPRESA,
  COALESCE(vendedor.nome, 'SEM VENDEDOR') AS VENDEDOR,
  'CONVENIO' AS FORMAPAGAMENTO,
  COUNT(DISTINCT cb.cod_transacao) AS QTD_VENDAS,
  SUM(COALESCE(ci.total_bruto, 0)) AS TOTAL_BRUTO,
  SUM(COALESCE(ci.total_vendido, 0)) AS TOTAL_VENDIDO,
  SUM(COALESCE(ci.total_bruto, 0) - COALESCE(ci.total_vendido, 0)) AS TOTAL_DESCONTO,
  SUM(COALESCE(cpar.total_convenio, 0)) AS TOTAL_PAGO_FORMA
FROM convenio_base cb
LEFT JOIN saida
  ON saida.cod_saida = cb.cod_transacao
 AND (
   saida.cod_empresa = cb.cod_empresaestoque
   OR (cb.cod_empresa IS NOT NULL AND saida.cod_empresa = cb.cod_empresa)
 )
LEFT JOIN pessoa vendedor
  ON vendedor.cod_pessoa = saida.cod_vendedor
LEFT JOIN convenio_itens ci
  ON ci.cod_transacao = cb.cod_transacao
 AND ci.cod_empresa = cb.cod_empresaestoque
LEFT JOIN convenio_parcelas cpar
  ON cpar.cod_transacao = cb.cod_transacao
 AND cpar.cod_empresa = cb.cod_empresaestoque
GROUP BY
  cb.dataemissao,
  cb.cod_empresaestoque,
  vendedor.nome

UNION ALL

SELECT
  dvb.dataencerramento AS DATA_VENDA,
  dvb.cod_empresaestoque AS COD_EMPRESA,
  COALESCE(vendedor.nome, 'SEM VENDEDOR') AS VENDEDOR,
  'DEVOLUCAO' AS FORMAPAGAMENTO,
  COUNT(DISTINCT dvb.cod_transacao) AS QTD_VENDAS,
  SUM(COALESCE(di.total_bruto, 0)) * -1 AS TOTAL_BRUTO,
  SUM(COALESCE(di.total_vendido, 0)) * -1 AS TOTAL_VENDIDO,
  SUM(COALESCE(di.total_bruto, 0) - COALESCE(di.total_vendido, 0)) * -1 AS TOTAL_DESCONTO,
  SUM(CAST(COALESCE(dvb.total, 0) AS DOUBLE PRECISION)) * -1 AS TOTAL_PAGO_FORMA
FROM devolucao_base dvb
LEFT JOIN pessoa vendedor
  ON vendedor.cod_pessoa = dvb.cod_vendedor
LEFT JOIN devolucao_itens di
  ON di.cod_transacao = dvb.cod_transacao
 AND di.cod_empresa = dvb.cod_empresaestoque
GROUP BY
  dvb.dataencerramento,
  dvb.cod_empresaestoque,
  vendedor.nome;
