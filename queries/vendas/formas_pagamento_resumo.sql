-- queries/vendas/formas_pagamento_resumo.sql
-- Resumo por empresa/vendedor/forma de pagamento (inclui CONVENIO e DEVOLUCAO)
-- Parâmetros (10):
--   1) empresa (int)
--   2) empresa (int) repetido p/ regra 13/18
--   3) dataInicio (date) - vendas (DATAEMISSAO)
--   4) dataFim (date)    - vendas (DATAEMISSAO)
--   5) dataInicio (date) - convenio (DATAEMISSAO)
--   6) dataFim (date)    - convenio (DATAEMISSAO)
--   7) dataInicio (date) - devolucao (DATAENCERRAMENTO)
--   8) dataFim (date)    - devolucao (DATAENCERRAMENTO)
--   9) excluirCreditos (int: 0/1)
--  10) incluirDevolucoes (int: 0/1)

WITH
P AS (
  SELECT
    CAST(? AS INTEGER) AS P_EMPRESA,
    CAST(? AS INTEGER) AS P_EMPRESA2,
    CAST(? AS DATE)    AS P_DATA_VENDAS_INI,
    CAST(? AS DATE)    AS P_DATA_VENDAS_FIM,
    CAST(? AS DATE)    AS P_DATA_CONVENIO_INI,
    CAST(? AS DATE)    AS P_DATA_CONVENIO_FIM,
    CAST(? AS DATE)    AS P_DATA_DEVOLUCAO_INI,
    CAST(? AS DATE)    AS P_DATA_DEVOLUCAO_FIM,
    CAST(? AS INTEGER) AS P_EXCLUI_CREDITOS,
    CAST(? AS INTEGER) AS P_INCLUI_DEVOLUCOES
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
  GROUP BY
    transacao.COD_TRANSACAO,
    transacao.COD_EMPRESA,
    finformapagamento.cod_formapagamentotipo
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

-- VENDAS NORMAIS
SELECT
  tbempresa.EMPRESA,
  tbempresa.empresa_cod_logico,
  tbempresa.empresa_nome_logico,
  vendedor.NOME AS VENDEDOR,

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

  SUM(
    COALESCE(
      IIF(finlancamentoparcela.datapagamento IS NULL,
        finlancamentoparcela.valor,
        finlancamentoparcela.valorpago
      ),
      0
    )
  ) AS TOTALGERAL,

  COUNT(DISTINCT transacao.cod_transacao) AS QTD_VENDAS,

  SUM(
    COALESCE(itens.TOTAL_BRUTO, 0)
    * COALESCE(pagamentos.TOTAL_PAGO_FORMA, 0)
    / NULLIF(COALESCE(pagamentos_totais.TOTAL_PAGO_TRANSACAO, 0), 0)
  ) AS TOTAL_BRUTO,
  SUM(
    (COALESCE(itens.TOTAL_BRUTO, 0) - COALESCE(itens.TOTAL_VENDIDO, 0))
    * COALESCE(pagamentos.TOTAL_PAGO_FORMA, 0)
    / NULLIF(COALESCE(pagamentos_totais.TOTAL_PAGO_TRANSACAO, 0), 0)
  ) AS TOTAL_DESCONTO,
  CASE
    WHEN SUM(COALESCE(itens.TOTAL_BRUTO, 0)) = 0 THEN 0
    ELSE (
      SUM(
        (COALESCE(itens.TOTAL_BRUTO, 0) - COALESCE(itens.TOTAL_VENDIDO, 0))
        * COALESCE(pagamentos.TOTAL_PAGO_FORMA, 0)
        / NULLIF(COALESCE(pagamentos_totais.TOTAL_PAGO_TRANSACAO, 0), 0)
      )
      / NULLIF(
        SUM(
          COALESCE(itens.TOTAL_BRUTO, 0)
          * COALESCE(pagamentos.TOTAL_PAGO_FORMA, 0)
          / NULLIF(COALESCE(pagamentos_totais.TOTAL_PAGO_TRANSACAO, 0), 0)
        ),
        0
      )
    ) * 100
  END AS PERC_DESCONTO

FROM
  transacao
  JOIN naturezaoperacao
    ON naturezaoperacao.cod_naturezaoperacao = transacao.cod_naturezaoperacao
  JOIN saida
    ON saida.cod_saida = transacao.cod_transacao
   AND saida.cod_empresa = transacao.cod_empresa
  JOIN pessoa vendedor
    ON vendedor.cod_pessoa = saida.cod_vendedor
  JOIN tbempresa
    ON tbempresa.cod_empresa = transacao.cod_empresaestoque
  JOIN finfaturatransacao
    ON finfaturatransacao.cod_faturatransacao = transacao.cod_faturatransacao
  JOIN finlancamento
    ON finlancamento.cod_faturatransacao = finfaturatransacao.cod_faturatransacao
  JOIN finlancamentoparcela
    ON finlancamentoparcela.cod_lancamento = finlancamento.cod_lancamento
  JOIN finformapagamento
    ON finformapagamento.cod_formapagamento = finlancamentoparcela.cod_formapagamento
  JOIN pagamentos_por_transacao pagamentos
    ON pagamentos.COD_TRANSACAO = transacao.COD_TRANSACAO
   AND pagamentos.COD_EMPRESA = transacao.COD_EMPRESA
   AND pagamentos.COD_FORMAPAGAMENTOTIPO = finformapagamento.cod_formapagamentotipo
  JOIN pagamentos_totais pagamentos_totais
    ON pagamentos_totais.COD_TRANSACAO = transacao.COD_TRANSACAO
   AND pagamentos_totais.COD_EMPRESA = transacao.COD_EMPRESA
  LEFT JOIN itens_por_transacao itens
    ON itens.COD_TRANSACAO = transacao.COD_TRANSACAO
   AND itens.COD_EMPRESA = transacao.COD_EMPRESA
  LEFT JOIN finformapagamentocartao
    ON finformapagamentocartao.cod_formapagamentocartao = finformapagamento.cod_formapagamento
  LEFT JOIN fincartaocreditotipo
    ON fincartaocreditotipo.cod_cartaocreditotipo = finformapagamentocartao.cod_cartaocreditotipo

WHERE
  naturezaoperacao.tipo = 1
  AND transacao.dataemissao BETWEEN P.P_DATA_VENDAS_INI AND P.P_DATA_VENDAS_FIM
  AND (
    P.P_EXCLUI_CREDITOS = 0
    OR finformapagamento.cod_formapagamentotipo <> 6
  )

GROUP BY
  tbempresa.EMPRESA,
  tbempresa.empresa_cod_logico,
  tbempresa.empresa_nome_logico,
  vendedor.NOME,
  FORMAPAGAMENTO

UNION ALL

-- CONVENIO
SELECT
  tbempresa.EMPRESA,
  tbempresa.empresa_cod_logico,
  tbempresa.empresa_nome_logico,
  vendedor.NOME AS VENDEDOR,
  'CONVENIO' AS FORMAPAGAMENTO,
  SUM(transacaoconvenioparcela.valor) AS TOTALGERAL,
  COUNT(DISTINCT transacao.cod_transacao) AS QTD_VENDAS,
  SUM(COALESCE(itens.TOTAL_BRUTO, 0)) AS TOTAL_BRUTO,
  SUM(COALESCE(itens.TOTAL_BRUTO, 0) - COALESCE(itens.TOTAL_VENDIDO, 0)) AS TOTAL_DESCONTO,
  CASE
    WHEN SUM(COALESCE(itens.TOTAL_BRUTO, 0)) = 0 THEN 0
    ELSE (
      SUM(COALESCE(itens.TOTAL_BRUTO, 0) - COALESCE(itens.TOTAL_VENDIDO, 0))
      / NULLIF(SUM(COALESCE(itens.TOTAL_BRUTO, 0)), 0)
    ) * 100
  END AS PERC_DESCONTO

FROM
  transacao
  JOIN transacaoconvenioparcela
    ON transacaoconvenioparcela.cod_transacao = transacao.cod_transacao
   AND transacaoconvenioparcela.cod_empresa = transacao.cod_empresa
  JOIN saida
    ON saida.cod_saida = transacao.cod_transacao
   AND saida.cod_empresa = transacao.cod_empresa
  JOIN pessoa vendedor
    ON vendedor.cod_pessoa = saida.cod_vendedor
  JOIN tbempresa
    ON tbempresa.cod_empresa = transacao.cod_empresaestoque
  LEFT JOIN itens_por_transacao itens
    ON itens.COD_TRANSACAO = transacao.COD_TRANSACAO
   AND itens.COD_EMPRESA = transacao.COD_EMPRESA

WHERE
  transacao.dataemissao BETWEEN P.P_DATA_CONVENIO_INI AND P.P_DATA_CONVENIO_FIM

GROUP BY
  tbempresa.EMPRESA,
  tbempresa.empresa_cod_logico,
  tbempresa.empresa_nome_logico,
  vendedor.NOME

UNION ALL

-- DEVOLUCAO
SELECT
  tbempresa.EMPRESA,
  tbempresa.empresa_cod_logico,
  tbempresa.empresa_nome_logico,
  vendedor.NOME AS VENDEDOR,
  'DEVOLUCAO' AS FORMAPAGAMENTO,
  SUM(transacaodevolucao.total) * -1 AS TOTALGERAL,
  COUNT(DISTINCT transacaodevolucao.cod_transacao) AS QTD_VENDAS,
  SUM(COALESCE(itens.TOTAL_BRUTO, 0)) * -1 AS TOTAL_BRUTO,
  SUM(COALESCE(itens.TOTAL_BRUTO, 0) - COALESCE(itens.TOTAL_VENDIDO, 0)) * -1 AS TOTAL_DESCONTO,
  CASE
    WHEN SUM(COALESCE(itens.TOTAL_BRUTO, 0)) = 0 THEN 0
    ELSE (
      SUM(COALESCE(itens.TOTAL_BRUTO, 0) - COALESCE(itens.TOTAL_VENDIDO, 0))
      / NULLIF(SUM(COALESCE(itens.TOTAL_BRUTO, 0)), 0)
    ) * 100
  END AS PERC_DESCONTO

FROM
  transacao transacaodevolucao
  JOIN entradanotafiscaldevolucao
    ON transacaodevolucao.cod_transacao = entradanotafiscaldevolucao.cod_entradanotafiscaldevolucao
   AND transacaodevolucao.cod_empresa = entradanotafiscaldevolucao.cod_empresa
  JOIN pessoa vendedor
    ON vendedor.cod_pessoa = entradanotafiscaldevolucao.cod_vendedor
  JOIN tbempresa
    ON tbempresa.cod_empresa = transacaodevolucao.cod_empresaestoque
  LEFT JOIN itens_por_transacao itens
    ON itens.COD_TRANSACAO = transacaodevolucao.COD_TRANSACAO
   AND itens.COD_EMPRESA = transacaodevolucao.COD_EMPRESA

WHERE
  P.P_INCLUI_DEVOLUCOES = 1
  AND transacaodevolucao.dataencerramento BETWEEN P.P_DATA_DEVOLUCAO_INI AND P.P_DATA_DEVOLUCAO_FIM

GROUP BY
  tbempresa.EMPRESA,
  tbempresa.empresa_cod_logico,
  tbempresa.empresa_nome_logico,
  vendedor.NOME;
