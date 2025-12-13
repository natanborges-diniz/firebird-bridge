-- queries/vendas/formas_pagamento_resumo.sql
-- Resumo por empresa/vendedor/forma de pagamento (inclui CONVENIO e DEVOLUCAO)
-- Parâmetros:
--   1) empresa (int)
--   2) empresa (int) (repetido p/ regra 13/18)
--   3) dataInicio (date) - vendas (DATAEMISSAO)
--   4) dataFim (date)    - vendas (DATAEMISSAO)
--   5) dataInicio (date) - devolução (DATAENCERRAMENTO)
--   6) dataFim (date)    - devolução (DATAENCERRAMENTO)

WITH
empresas_filtradas AS (
  SELECT e.COD_EMPRESA
  FROM EMPRESA e
  WHERE e.COD_EMPRESA NOT IN (3, 5, 7, 8, 11, 12)
    AND (
      e.COD_EMPRESA = CAST(? AS INTEGER)
      OR (
        CAST(? AS INTEGER) IN (13, 18)
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

  COUNT(DISTINCT transacao.cod_transacao) AS QTD_VENDAS

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
  LEFT JOIN finformapagamentocartao
    ON finformapagamentocartao.cod_formapagamentocartao = finformapagamento.cod_formapagamento
  LEFT JOIN fincartaocreditotipo
    ON fincartaocreditotipo.cod_cartaocreditotipo = finformapagamentocartao.cod_cartaocreditotipo

WHERE
  naturezaoperacao.tipo = 1
  AND transacao.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)

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
  COUNT(DISTINCT transacao.cod_transacao) AS QTD_VENDAS

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

WHERE
  transacao.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)

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
  COUNT(DISTINCT transacaodevolucao.cod_transacao) AS QTD_VENDAS

FROM
  transacao transacaodevolucao
  JOIN entradanotafiscaldevolucao
    ON transacaodevolucao.cod_transacao = entradanotafiscaldevolucao.cod_entradanotafiscaldevolucao
   AND transacaodevolucao.cod_empresa = entradanotafiscaldevolucao.cod_empresa
  JOIN pessoa vendedor
    ON vendedor.cod_pessoa = entradanotafiscaldevolucao.cod_vendedor
  JOIN tbempresa
    ON tbempresa.cod_empresa = transacaodevolucao.cod_empresaestoque

WHERE
  transacaodevolucao.dataencerramento BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)

GROUP BY
  tbempresa.EMPRESA,
  tbempresa.empresa_cod_logico,
  tbempresa.empresa_nome_logico,
  vendedor.NOME;
