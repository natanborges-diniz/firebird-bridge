-- queries/vendas/formas_pagamento_auditoria.sql
-- Auditoria de vendas por forma de pagamento (vendas normais)
-- Parâmetros (7):
--   1) empresa (int)
--   2) empresa (int) repetido p/ regra 13/18
--   3) dataInicio (date) - vendas (DATAEMISSAO)
--   4) dataFim (date)    - vendas (DATAEMISSAO)
--   5) excluirCreditos (int: 0/1)
--   6) rowStart (int) - paginação
--   7) rowEnd (int) - paginação

WITH
P AS (
  SELECT
    CAST(? AS INTEGER) AS P_EMPRESA,
    CAST(? AS INTEGER) AS P_EMPRESA2,
    CAST(? AS DATE)    AS P_DATA_VENDAS_INI,
    CAST(? AS DATE)    AS P_DATA_VENDAS_FIM,
    CAST(? AS INTEGER) AS P_EXCLUI_CREDITOS
  FROM RDB$DATABASE
),
empresas_filtradas AS (
  SELECT e.COD_EMPRESA
  FROM EMPRESA e
  JOIN P ON 1=1
  WHERE e.COD_EMPRESA NOT IN (3, 5, 7, 8, 11, 12)
    AND (
      e.COD_EMPRESA = P.P_EMPRESA
      OR (
        P.P_EMPRESA2 IN (13, 18)
        AND e.COD_EMPRESA IN (13, 18)
      )
    )
),
tbempresa AS (
  SELECT
    e.COD_EMPRESA,
    p.NOME AS EMPRESA,
    CASE WHEN e.COD_EMPRESA IN (13, 18) THEN 13 ELSE e.COD_EMPRESA END AS empresa_cod_logico,
    CASE WHEN e.COD_EMPRESA IN (13, 18) THEN 'DINIZ SUPER' ELSE p.NOME END AS empresa_nome_logico
  FROM EMPRESA e
  JOIN PESSOA p ON p.COD_PESSOA = e.COD_EMPRESA
  JOIN empresas_filtradas ef ON ef.COD_EMPRESA = e.COD_EMPRESA
),
itens_por_transacao AS (
  SELECT
    ti.COD_TRANSACAO,
    ti.COD_EMPRESA,
    SUM(COALESCE(ti.VALORORIGINAL, 0) * COALESCE(ti.QUANTIDADE, 0)) AS TOTAL_BRUTO,
    SUM(COALESCE(ti.TOTAL, 0) - COALESCE(ti.TOTALIPI, 0)) AS TOTAL_VENDIDO
  FROM TRANSACAO_ITEM ti
  GROUP BY
    ti.COD_TRANSACAO,
    ti.COD_EMPRESA
),
pagamentos_por_transacao AS (
  SELECT
    transacao.COD_TRANSACAO,
    transacao.COD_EMPRESA,
    finformapagamento.cod_formapagamentotipo AS COD_FORMAPAGAMENTOTIPO,
    fincartaocreditotipo.credito AS CARTAO_CREDITO,
    SUM(
      COALESCE(
        IIF(finlancamentoparcela.datapagamento IS NULL,
          finlancamentoparcela.valor,
          finlancamentoparcela.valorpago
        ),
        0
      )
    ) AS TOTAL_PAGO_FORMA
  FROM
    transacao
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
  GROUP BY
    transacao.COD_TRANSACAO,
    transacao.COD_EMPRESA,
    finformapagamento.cod_formapagamentotipo,
    fincartaocreditotipo.credito
),
pagamentos_totais AS (
  SELECT
    COD_TRANSACAO,
    COD_EMPRESA,
    SUM(TOTAL_PAGO_FORMA) AS TOTAL_PAGO_TRANSACAO
  FROM pagamentos_por_transacao
  GROUP BY
    COD_TRANSACAO,
    COD_EMPRESA
)

SELECT
  tbempresa.EMPRESA,
  tbempresa.empresa_cod_logico,
  tbempresa.empresa_nome_logico,
  vendedor.NOME AS VENDEDOR,
  transacao.COD_TRANSACAO,
  transacao.DATAEMISSAO,
  pagamentos.COD_FORMAPAGAMENTOTIPO AS COD_FORMAPAGAMENTO,
  CASE pagamentos.cod_formapagamentotipo
    WHEN 1 THEN 'DINHEIRO'
    WHEN 2 THEN 'CHEQUE'
    WHEN 3 THEN
      CASE
        WHEN pagamentos.cartao_credito = 'T' THEN 'CARTAO CREDITO'
        ELSE 'CARTAO DEBITO'
      END
    WHEN 4 THEN 'BANCO'
    WHEN 5 THEN 'CARNE'
    WHEN 6 THEN 'CREDITOS'
    ELSE 'OUTROS'
  END AS FORMAPAGAMENTO,
  COALESCE(itens.TOTAL_BRUTO, 0) AS TOTAL_BRUTO,
  COALESCE(itens.TOTAL_VENDIDO, 0) AS TOTAL_VENDIDO,
  COALESCE(itens.TOTAL_BRUTO, 0) - COALESCE(itens.TOTAL_VENDIDO, 0) AS TOTAL_DESCONTO,
  COALESCE(pagamentos.TOTAL_PAGO_FORMA, 0) AS TOTAL_PAGO_FORMA,
  COALESCE(pagamentos_totais.TOTAL_PAGO_TRANSACAO, 0) AS TOTAL_PAGO_TRANSACAO,
  CAST(COALESCE(itens.TOTAL_BRUTO, 0) AS DOUBLE PRECISION)
    * CAST(COALESCE(pagamentos.TOTAL_PAGO_FORMA, 0) AS DOUBLE PRECISION)
    / NULLIF(CAST(COALESCE(pagamentos_totais.TOTAL_PAGO_TRANSACAO, 0) AS DOUBLE PRECISION), 0)
    AS TOTAL_BRUTO_RATEADO,
  CAST((COALESCE(itens.TOTAL_BRUTO, 0) - COALESCE(itens.TOTAL_VENDIDO, 0)) AS DOUBLE PRECISION)
    * CAST(COALESCE(pagamentos.TOTAL_PAGO_FORMA, 0) AS DOUBLE PRECISION)
    / NULLIF(CAST(COALESCE(pagamentos_totais.TOTAL_PAGO_TRANSACAO, 0) AS DOUBLE PRECISION), 0)
    AS TOTAL_DESCONTO_RATEADO

FROM
  P
  JOIN transacao ON 1=1
  JOIN naturezaoperacao
    ON naturezaoperacao.cod_naturezaoperacao = transacao.cod_naturezaoperacao
  JOIN saida
    ON saida.cod_saida = transacao.cod_transacao
   AND saida.cod_empresa = transacao.cod_empresa
  JOIN pessoa vendedor
    ON vendedor.cod_pessoa = saida.cod_vendedor
  JOIN tbempresa
    ON tbempresa.cod_empresa = transacao.cod_empresaestoque
  JOIN pagamentos_por_transacao pagamentos
    ON pagamentos.COD_TRANSACAO = transacao.COD_TRANSACAO
   AND pagamentos.COD_EMPRESA = transacao.COD_EMPRESA
  JOIN pagamentos_totais pagamentos_totais
    ON pagamentos_totais.COD_TRANSACAO = transacao.COD_TRANSACAO
   AND pagamentos_totais.COD_EMPRESA = transacao.COD_EMPRESA
  LEFT JOIN itens_por_transacao itens
    ON itens.COD_TRANSACAO = transacao.COD_TRANSACAO
   AND itens.COD_EMPRESA = transacao.COD_EMPRESA

WHERE
  naturezaoperacao.tipo = 1
  AND transacao.dataemissao BETWEEN P.P_DATA_VENDAS_INI AND P.P_DATA_VENDAS_FIM
  AND (
    P.P_EXCLUI_CREDITOS = 0
    OR pagamentos.cod_formapagamentotipo <> 6
  )

ROWS ? TO ?;
