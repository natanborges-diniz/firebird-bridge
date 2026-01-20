-- queries/vendas/resumo_diario_simples.sql
-- Resumo diário simples com rateio por forma de pagamento
-- Parâmetros (13):
--   1) empresa (int) - empresa ou empresa estoque
--   2) empresa (int) - empresa ou empresa estoque (mesmo valor)
--   3) dataInicio (date) - vendas (DATAEMISSAO)
--   4) dataFim (date)    - vendas (DATAEMISSAO)
--   5) excluirCreditos (int: 0/1)
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
parcelas_agregadas AS (
  SELECT
    tb.cod_transacao,
    tb.cod_empresaestoque AS cod_empresa,
    fp.cod_formapagamentotipo,
    cct.credito,
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
  WHERE (? = 0 OR fp.cod_formapagamentotipo <> 6 OR fp.cod_formapagamentotipo IS NULL)
  GROUP BY
    tb.cod_transacao,
    tb.cod_empresaestoque,
    fp.cod_formapagamentotipo,
    cct.credito
),
parcelas_com_proporcao AS (
  SELECT
    pa.*,
    pa.total_pago / NULLIF(
      SUM(pa.total_pago) OVER (PARTITION BY pa.cod_transacao, pa.cod_empresa),
      0
    ) AS proporcao
  FROM parcelas_agregadas pa
)

SELECT
  tb.dataemissao AS DATA_VENDA,
  tb.cod_empresaestoque AS COD_EMPRESA,
  COALESCE(v.nome, 'SEM VENDEDOR') AS VENDEDOR,
  CASE pp.cod_formapagamentotipo
    WHEN 1 THEN 'DINHEIRO'
    WHEN 2 THEN 'CHEQUE'
    WHEN 3 THEN
      CASE
        WHEN pp.credito = 'T' THEN 'CARTAO CREDITO'
        ELSE 'CARTAO DEBITO'
      END
    WHEN 4 THEN 'BANCO'
    WHEN 5 THEN 'CARNE'
    WHEN 6 THEN 'CREDITOS'
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
JOIN parcelas_com_proporcao pp
  ON pp.cod_transacao = tb.cod_transacao
 AND pp.cod_empresa = tb.cod_empresaestoque
GROUP BY
  tb.dataemissao,
  tb.cod_empresaestoque,
  v.nome,
  FORMAPAGAMENTO

UNION ALL

SELECT
  transacao.dataemissao AS DATA_VENDA,
  transacao.cod_empresaestoque AS COD_EMPRESA,
  COALESCE(vendedor.nome, 'SEM VENDEDOR') AS VENDEDOR,
  'CONVENIO' AS FORMAPAGAMENTO,
  COUNT(DISTINCT transacao.cod_transacao) AS QTD_VENDAS,
  SUM(
    CAST(COALESCE(ti.valororiginal, 0) AS DOUBLE PRECISION)
    * CAST(COALESCE(ti.quantidade, 0) AS DOUBLE PRECISION)
  ) AS TOTAL_BRUTO,
  SUM(
    CAST(COALESCE(ti.total, 0) AS DOUBLE PRECISION)
    - CAST(COALESCE(ti.totalipi, 0) AS DOUBLE PRECISION)
  ) AS TOTAL_VENDIDO,
  SUM(
    (
      CAST(COALESCE(ti.valororiginal, 0) AS DOUBLE PRECISION)
      * CAST(COALESCE(ti.quantidade, 0) AS DOUBLE PRECISION)
    )
    - (
      CAST(COALESCE(ti.total, 0) AS DOUBLE PRECISION)
      - CAST(COALESCE(ti.totalipi, 0) AS DOUBLE PRECISION)
    )
  ) AS TOTAL_DESCONTO,
  SUM(CAST(COALESCE(transacaoconvenioparcela.valor, 0) AS DOUBLE PRECISION)) AS TOTAL_PAGO_FORMA
FROM transacao
JOIN transacaoconvenioparcela
  ON transacaoconvenioparcela.cod_transacao = transacao.cod_transacao
 AND transacaoconvenioparcela.cod_empresa = transacao.cod_empresa
LEFT JOIN saida
  ON saida.cod_saida = transacao.cod_transacao
 AND (
   saida.cod_empresa = transacao.cod_empresaestoque
   OR (transacao.cod_empresa IS NOT NULL AND saida.cod_empresa = transacao.cod_empresa)
 )
LEFT JOIN pessoa vendedor
  ON vendedor.cod_pessoa = saida.cod_vendedor
LEFT JOIN transacao_item ti
  ON ti.cod_transacao = transacao.cod_transacao
 AND (
   ti.cod_empresa = transacao.cod_empresaestoque
   OR (transacao.cod_empresa IS NOT NULL AND ti.cod_empresa = transacao.cod_empresa)
 )
WHERE transacao.dataemissao BETWEEN ? AND ?
  AND (transacao.cod_empresaestoque = ? OR transacao.cod_empresa = ?)
GROUP BY
  transacao.dataemissao,
  transacao.cod_empresaestoque,
  vendedor.nome

UNION ALL

SELECT
  transacaodevolucao.dataencerramento AS DATA_VENDA,
  transacaodevolucao.cod_empresaestoque AS COD_EMPRESA,
  COALESCE(vendedor.nome, 'SEM VENDEDOR') AS VENDEDOR,
  'DEVOLUCAO' AS FORMAPAGAMENTO,
  COUNT(DISTINCT transacaodevolucao.cod_transacao) AS QTD_VENDAS,
  SUM(
    CAST(COALESCE(ti.valororiginal, 0) AS DOUBLE PRECISION)
    * CAST(COALESCE(ti.quantidade, 0) AS DOUBLE PRECISION)
  ) * -1 AS TOTAL_BRUTO,
  SUM(
    CAST(COALESCE(ti.total, 0) AS DOUBLE PRECISION)
    - CAST(COALESCE(ti.totalipi, 0) AS DOUBLE PRECISION)
  ) * -1 AS TOTAL_VENDIDO,
  SUM(
    (
      CAST(COALESCE(ti.valororiginal, 0) AS DOUBLE PRECISION)
      * CAST(COALESCE(ti.quantidade, 0) AS DOUBLE PRECISION)
    )
    - (
      CAST(COALESCE(ti.total, 0) AS DOUBLE PRECISION)
      - CAST(COALESCE(ti.totalipi, 0) AS DOUBLE PRECISION)
    )
  ) * -1 AS TOTAL_DESCONTO,
  SUM(CAST(COALESCE(transacaodevolucao.total, 0) AS DOUBLE PRECISION)) * -1 AS TOTAL_PAGO_FORMA
FROM transacao transacaodevolucao
JOIN entradanotafiscaldevolucao
  ON transacaodevolucao.cod_transacao = entradanotafiscaldevolucao.cod_entradanotafiscaldevolucao
 AND transacaodevolucao.cod_empresa = entradanotafiscaldevolucao.cod_empresa
LEFT JOIN pessoa vendedor
  ON vendedor.cod_pessoa = entradanotafiscaldevolucao.cod_vendedor
LEFT JOIN transacao_item ti
  ON ti.cod_transacao = transacaodevolucao.cod_transacao
 AND (
   ti.cod_empresa = transacaodevolucao.cod_empresaestoque
   OR (transacaodevolucao.cod_empresa IS NOT NULL AND ti.cod_empresa = transacaodevolucao.cod_empresa)
 )
WHERE transacaodevolucao.dataencerramento BETWEEN ? AND ?
  AND (transacaodevolucao.cod_empresaestoque = ? OR transacaodevolucao.cod_empresa = ?)
GROUP BY
  transacaodevolucao.dataencerramento,
  transacaodevolucao.cod_empresaestoque,
  vendedor.nome;
