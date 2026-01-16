-- queries/vendas/resumo_diario_simples.sql
-- Resumo diário simples com rateio por forma de pagamento
-- Parâmetros (4):
--   1) empresa (int)
--   2) dataInicio (date) - vendas (DATAEMISSAO)
--   3) dataFim (date)    - vendas (DATAEMISSAO)
--   4) excluirCreditos (int: 0/1)

WITH
transacoes_base AS (
  SELECT
    t.cod_transacao,
    t.cod_empresa,
    t.cod_empresaestoque,
    t.dataemissao,
    t.cod_faturatransacao,
    s.cod_vendedor
  FROM transacao t
  JOIN naturezaoperacao no ON no.cod_naturezaoperacao = t.cod_naturezaoperacao
  JOIN saida s ON s.cod_saida = t.cod_transacao AND s.cod_empresa = t.cod_empresa
  WHERE no.tipo = 1
    AND t.cod_empresaestoque = ?
    AND t.dataemissao BETWEEN ? AND ?
),
itens_agregados AS (
  SELECT
    ti.cod_transacao,
    ti.cod_empresa,
    SUM(COALESCE(ti.valororiginal, 0) * COALESCE(ti.quantidade, 0)) AS total_bruto,
    SUM(COALESCE(ti.total, 0) - COALESCE(ti.totalipi, 0)) AS total_vendido
  FROM transacao_item ti
  JOIN transacoes_base tb ON tb.cod_transacao = ti.cod_transacao AND tb.cod_empresa = ti.cod_empresa
  GROUP BY
    ti.cod_transacao,
    ti.cod_empresa
),
parcelas_agregadas AS (
  SELECT
    tb.cod_transacao,
    tb.cod_empresa,
    fp.cod_formapagamentotipo,
    cct.credito,
    SUM(
      COALESCE(
        IIF(flp.datapagamento IS NULL, flp.valor, flp.valorpago),
        0
      )
    ) AS total_pago
  FROM transacoes_base tb
  JOIN finfaturatransacao fft ON fft.cod_faturatransacao = tb.cod_faturatransacao
  JOIN finlancamento fl ON fl.cod_faturatransacao = fft.cod_faturatransacao
  JOIN finlancamentoparcela flp ON flp.cod_lancamento = fl.cod_lancamento
  JOIN finformapagamento fp ON fp.cod_formapagamento = flp.cod_formapagamento
  LEFT JOIN finformapagamentocartao fpc ON fpc.cod_formapagamentocartao = fp.cod_formapagamento
  LEFT JOIN fincartaocreditotipo cct ON cct.cod_cartaocreditotipo = fpc.cod_cartaocreditotipo
  WHERE (? = 0 OR fp.cod_formapagamentotipo <> 6)
  GROUP BY
    tb.cod_transacao,
    tb.cod_empresa,
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
  v.nome AS VENDEDOR,
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
  COUNT(DISTINCT tb.cod_transacao || '-' || tb.cod_empresa) AS QTD_VENDAS,
  SUM(COALESCE(ia.total_bruto, 0) * COALESCE(pp.proporcao, 1)) AS TOTAL_BRUTO,
  SUM(COALESCE(ia.total_vendido, 0) * COALESCE(pp.proporcao, 1)) AS TOTAL_VENDIDO,
  SUM(
    (COALESCE(ia.total_bruto, 0) - COALESCE(ia.total_vendido, 0))
    * COALESCE(pp.proporcao, 1)
  ) AS TOTAL_DESCONTO,
  SUM(pp.total_pago) AS TOTAL_PAGO_FORMA
FROM transacoes_base tb
JOIN pessoa v ON v.cod_pessoa = tb.cod_vendedor
JOIN itens_agregados ia ON ia.cod_transacao = tb.cod_transacao AND ia.cod_empresa = tb.cod_empresa
JOIN parcelas_com_proporcao pp ON pp.cod_transacao = tb.cod_transacao AND pp.cod_empresa = tb.cod_empresa
GROUP BY
  tb.dataemissao,
  tb.cod_empresaestoque,
  v.nome,
  FORMAPAGAMENTO;
