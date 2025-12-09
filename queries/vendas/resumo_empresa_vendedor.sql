-- queries/vendas/resumo_empresa_vendedor.sql
-- Descrição: Resumo de vendas por empresa e vendedor.
-- Grain: 1 linha por (EMPRESA, VENDEDOR).
-- Parâmetros:
--    1) dataInicio (DATE)
--    2) dataFim (DATE)
--    3) dataInicio devolução
--    4) dataFim devolução

WITH TBEMPRESA AS
(
  SELECT
    PESSOA.NOME AS EMPRESA,
    EMPRESA.COD_EMPRESA
  FROM
    PESSOA
    JOIN EMPRESA ON (PESSOA.COD_PESSOA = EMPRESA.COD_EMPRESA)
)

-- VENDAS
SELECT
  TBEMPRESA.EMPRESA,
  vendedor.nome AS VENDEDOR,
  SUM(transacao_item.valororiginal * transacao_item.quantidade) AS TOTALORIGINAL,
  SUM(transacao_item.total - transacao_item.valordesconto - transacao_item.totalipi) AS TOTALVENDIDO,
  SUM(transacao_item.total - transacao_item.valordesconto - transacao_item.totalipi)
/ NULLIF(COUNT(DISTINCT transacao.cod_transacao), 0) AS TICKETMEDIO,
  0 AS TOTALDEVOLUCAO,
  COUNT(DISTINCT transacao.cod_transacao) AS QTDTRANSACAO,
  0 AS QTDDEVOLUCAO
FROM
  transacao
  JOIN transacao_item
    ON (transacao.cod_transacao = transacao_item.cod_transacao AND
        transacao.cod_empresa = transacao_item.cod_empresa)
  JOIN naturezaoperacao
    ON (transacao_item.cod_naturezaoperacao = naturezaoperacao.cod_naturezaoperacao)
  JOIN saida
    ON (saida.cod_saida = transacao.cod_transacao AND
        saida.cod_empresa = transacao.cod_empresa)
  JOIN pessoa vendedor
    ON (vendedor.cod_pessoa = saida.cod_vendedor)
  JOIN TBEMPRESA
    ON (TBEMPRESA.COD_EMPRESA = transacao.cod_empresaestoque)
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
  naturezaoperacao.tipo = 1
  AND transacao.dataencerramento >= ?
  AND transacao.dataencerramento <= ?
GROUP BY 1,2

UNION ALL

-- DEVOLUÇÕES
SELECT
  TBEMPRESA.EMPRESA,
  vendedor.nome AS VENDEDOR,
  SUM(transacao_item.total) * -1 AS TOTALORIGINAL,
  SUM(transacao_item.total) * -1 AS TOTALVENDIDO,
  0 AS TICKETMEDIO,
  SUM(transacao_item.total) AS TOTALDEVOLUCAO,
  0 AS QTDTRANSACAO,
  COUNT(DISTINCT transacaodevolucao.cod_transacao) AS QTDDEVOLUCAO
FROM
  transacao transacaodevolucao
  JOIN entradanotafiscaldevolucao
    ON (
      transacaodevolucao.cod_transacao = entradanotafiscaldevolucao.cod_entradanotafiscaldevolucao AND
      transacaodevolucao.cod_empresa = entradanotafiscaldevolucao.cod_empresa
    )
  JOIN transacao_item
    ON (transacao_item.cod_transacao = transacaodevolucao.cod_transacao AND
        transacao_item.cod_empresa = transacaodevolucao.cod_empresa)
  JOIN TBEMPRESA
    ON (TBEMPRESA.COD_EMPRESA = transacaodevolucao.cod_empresaestoque)
  JOIN pessoa vendedor
    ON (vendedor.cod_pessoa = entradanotafiscaldevolucao.cod_vendedor)
WHERE
  transacaodevolucao.dataencerramento >= ?
  AND transacaodevolucao.dataencerramento <= ?
GROUP BY 1,2;
