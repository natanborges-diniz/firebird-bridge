-- queries/vendas/formas_pagamento_resumo.sql
-- Resumo de vendas por empresa, vendedor e forma de pagamento.
-- Parâmetros:
--   1) dataInicio (DATE)
--   2) dataFim (DATE)
--   3) dataInicio (para convênio)
--   4) dataFim (para convênio)
--   5) dataInicio (para devolução)
--   6) dataFim (para devolução)

WITH TBEMPRESA AS
(
  SELECT
    PESSOA.NOME AS EMPRESA,
    EMPRESA.COD_EMPRESA
  /* CAMPOS LÓGICOS DE EMPRESA (SUPER + SUPER SHOPPING) */
  case
    when fl.cod_empresa in (13, 18) then 13
    else fl.cod_empresa
  end                                         as empresa_cod_logico,

  case
    when fl.cod_empresa in (13, 18) then 'DINIZ SUPER'
    else pe_emp.nome
  end                                         as empresa_nome_logico,
  FROM
    PESSOA
    JOIN EMPRESA ON (PESSOA.COD_PESSOA = EMPRESA.COD_EMPRESA)
)

-- BLOCO PRINCIPAL: VENDAS NORMAIS, AGRUPADAS POR FORMA DE PAGAMENTO
SELECT
  TBEMPRESA.EMPRESA,
  vendedor.nome AS VENDEDOR,

  -- Tipo consolidado de forma de pagamento
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
    -- Valor total da parcela (considerando pago ou a vencer)
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
    ON (transacao.cod_naturezaoperacao = naturezaoperacao.cod_naturezaoperacao)
  JOIN saida
    ON (saida.cod_saida = transacao.cod_transacao AND
        saida.cod_empresa = transacao.cod_empresa)
  JOIN pessoa vendedor
    ON (vendedor.cod_pessoa = saida.cod_vendedor)
  JOIN TBEMPRESA
    ON (TBEMPRESA.COD_EMPRESA = transacao.cod_empresaestoque)
  JOIN finfaturatransacao
    ON (finfaturatransacao.cod_faturatransacao = transacao.cod_faturatransacao)
  JOIN finlancamento
    ON (finlancamento.cod_faturatransacao = finfaturatransacao.cod_faturatransacao)
  JOIN finlancamentoparcela
    ON (finlancamentoparcela.cod_lancamento = finlancamento.cod_lancamento)
  JOIN finformapagamento
    ON (finformapagamento.cod_formapagamento = finlancamentoparcela.cod_formapagamento)
  LEFT JOIN finformapagamentocartao
    ON (finformapagamentocartao.cod_formapagamentocartao = finformapagamento.cod_formapagamento)
  LEFT JOIN fincartaocreditotipo
    ON (fincartaocreditotipo.cod_cartaocreditotipo = finformapagamentocartao.cod_cartaocreditotipo)
WHERE
  naturezaoperacao.tipo = 1
  AND transacao.dataemissao >= ?
  AND transacao.dataemissao <= ?
GROUP BY
  TBEMPRESA.EMPRESA,
  vendedor.nome,
  FORMAPAGAMENTO

UNION ALL

-- BLOCO: CONVÊNIO COMO UMA "FORMA DE PAGAMENTO" AGRUPADA
SELECT
  TBEMPRESA.EMPRESA,
  vendedor.nome AS VENDEDOR,
  'CONVENIO' AS FORMAPAGAMENTO,
  SUM(transacaoconvenioparcela.valor) AS TOTALGERAL,
  COUNT(DISTINCT transacao.cod_transacao) AS QTD_VENDAS
FROM
  transacao
  JOIN transacaoconvenioparcela
    ON (transacaoconvenioparcela.cod_transacao = transacao.cod_transacao AND
        transacaoconvenioparcela.cod_empresa = transacao.cod_empresa)
  JOIN saida
    ON (saida.cod_saida = transacao.cod_transacao AND
        saida.cod_empresa = transacao.cod_empresa)
  JOIN TBEMPRESA
    ON (TBEMPRESA.COD_EMPRESA = transacao.cod_empresaestoque)
  JOIN pessoa vendedor
    ON (vendedor.cod_pessoa = saida.cod_vendedor)
WHERE
  /* Ignora empresas lixo */
  fl.cod_empresa not in (3, 5, 7, 8, 11, 12)
  and (
    /* Empresas normais: filtra direto pelo código informado */
    fl.cod_empresa = cast(? as integer)
    or (
      /* Se a empresa pedida for 13 ou 18, traz tanto 13 quanto 18 */
      cast(? as integer) in (13, 18)
      and fl.cod_empresa in (13, 18)
    )
  )
  transacao.dataemissao >= ?
  AND transacao.dataemissao <= ?
GROUP BY
  TBEMPRESA.EMPRESA,
  vendedor.nome

UNION ALL

-- BLOCO: DEVOLUÇÕES AGRUPADAS COMO "DEVOLUCAO"
SELECT
  TBEMPRESA.EMPRESA,
  vendedor.nome AS VENDEDOR,
  'DEVOLUCAO' AS FORMAPAGAMENTO,
  SUM(transacaodevolucao.total) * -1 AS TOTALGERAL,
  COUNT(DISTINCT transacaodevolucao.cod_transacao) AS QTD_VENDAS
FROM
  transacao transacaodevolucao
  JOIN entradanotafiscaldevolucao
    ON (
      transacaodevolucao.cod_transacao = entradanotafiscaldevolucao.cod_entradanotafiscaldevolucao AND
      transacaodevolucao.cod_empresa = entradanotafiscaldevolucao.cod_empresa
    )
  JOIN TBEMPRESA
    ON (TBEMPRESA.COD_EMPRESA = transacaodevolucao.cod_empresaestoque)
  JOIN pessoa vendedor
    ON (vendedor.cod_pessoa = entradanotafiscaldevolucao.cod_vendedor)
WHERE
  transacaodevolucao.dataencerramento >= ?
  AND transacaodevolucao.dataencerramento <= ?
GROUP BY
  TBEMPRESA.EMPRESA,
  vendedor.nome;
