-- queries/vendas/resumo_diario_simples.sql
-- Resumo diário simples (sem CTEs) para alimentar cache diário
-- Parâmetros (4):
--   1) empresa (int)
--   2) dataInicio (date) - vendas (DATAEMISSAO)
--   3) dataFim (date)    - vendas (DATAEMISSAO)
--   4) excluirCreditos (int: 0/1)

SELECT
  transacao.dataemissao AS DATA_VENDA,
  transacao.cod_empresaestoque AS COD_EMPRESA,
  vendedor.nome AS VENDEDOR,
  CASE finformapagamento.cod_formapagamentotipo
    WHEN 1 THEN 'DINHEIRO'
    WHEN 2 THEN 'CHEQUE'
    WHEN 3 THEN
      CASE
        WHEN fincartaocreditotipo.credito = 'T' THEN 'CARTAO CREDITO'
        ELSE 'CARTAO DEBITO'
      END
    WHEN 4 THEN 'BANCO'
    WHEN 5 THEN 'CARNE'
    WHEN 6 THEN 'CREDITOS'
    ELSE 'OUTROS'
  END AS FORMAPAGAMENTO,
  COUNT(DISTINCT transacao.cod_transacao) AS QTD_VENDAS,
  SUM(COALESCE(itens.total_bruto, 0)) AS TOTAL_BRUTO,
  SUM(COALESCE(itens.total_vendido, 0)) AS TOTAL_VENDIDO,
  SUM(COALESCE(itens.total_bruto, 0) - COALESCE(itens.total_vendido, 0)) AS TOTAL_DESCONTO,
  SUM(
    COALESCE(
      IIF(finlancamentoparcela.datapagamento IS NULL,
        finlancamentoparcela.valor,
        finlancamentoparcela.valorpago
      ),
      0
    )
  ) AS TOTAL_PAGO_FORMA

FROM transacao
JOIN naturezaoperacao
  ON naturezaoperacao.cod_naturezaoperacao = transacao.cod_naturezaoperacao
JOIN saida
  ON saida.cod_saida = transacao.cod_transacao
 AND saida.cod_empresa = transacao.cod_empresa
JOIN pessoa vendedor
  ON vendedor.cod_pessoa = saida.cod_vendedor
JOIN finfaturatransacao
  ON finfaturatransacao.cod_faturatransacao = transacao.cod_faturatransacao
JOIN finlancamento
  ON finlancamento.cod_faturatransacao = finfaturatransacao.cod_faturatransacao
JOIN finlancamentoparcela
  ON finlancamentoparcela.cod_lancamento = finlancamento.cod_lancamento
JOIN finformapagamento
  ON finformapagamento.cod_formapagamento = finlancamentoparcela.cod_formapagamento
LEFT JOIN finformapagamentocartao
  ON finformapagamentocartao.cod_formapagamentocartao = finformapagamento.cod_formapagamento
LEFT JOIN fincartaocreditotipo
  ON fincartaocreditotipo.cod_cartaocreditotipo = finformapagamentocartao.cod_cartaocreditotipo
LEFT JOIN (
  SELECT
    ti.cod_transacao,
    ti.cod_empresa,
    SUM(COALESCE(ti.valororiginal, 0) * COALESCE(ti.quantidade, 0)) AS total_bruto,
    SUM(COALESCE(ti.total, 0) - COALESCE(ti.totalipi, 0)) AS total_vendido
  FROM transacao_item ti
  GROUP BY
    ti.cod_transacao,
    ti.cod_empresa
) itens
  ON itens.cod_transacao = transacao.cod_transacao
 AND itens.cod_empresa = transacao.cod_empresa

WHERE
  naturezaoperacao.tipo = 1
  AND transacao.cod_empresaestoque = ?
  AND transacao.dataemissao BETWEEN ? AND ?
  AND (
    ? = 0
    OR finformapagamento.cod_formapagamentotipo <> 6
  )

GROUP BY
  transacao.dataemissao,
  transacao.cod_empresaestoque,
  vendedor.nome,
  FORMAPAGAMENTO;
