-- queries/estoque/estoque_completo.sql
-- Estoque completo (apenas prateleira) com dados de venda e custo
-- Parâmetros:
--   1) empresa (int)

WITH
  tbEMPRESA AS (
    SELECT
      EMPRESA.COD_EMPRESA,
      PESSOA.NOME AS EMPRESA
    FROM
      EMPRESA
      JOIN PESSOA ON PESSOA.COD_PESSOA = EMPRESA.COD_EMPRESA
  ),

  tbestoque AS (
    SELECT
      estoque.cod_empresa,
      estoque.cod_produto,
      SUM(estoque.saldo) AS saldo
    FROM
      estoque
    WHERE
      estoque.cod_estoquelocal = 1
      AND estoque.saldo > 0
    GROUP BY
      1, 2
  ),

  tbmarcamodeloar AS (
    SELECT
      item_itemclassificacao.cod_item,
      itemclassificacao.descricao
    FROM
      itemclassificacao
      JOIN item_itemclassificacao
        ON item_itemclassificacao.cod_itemclassificacao = itemclassificacao.cod_itemclassificacao
    WHERE
      itemclassificacao.cod_dwitemclassificacao = 42
  ),

  tbUltimaEntrada AS (
    SELECT
      transacao_item.cod_item AS cod_produto,
      transacao.cod_empresa,
      MAX(transacao.dataencerramento) AS data_ultima_entrada
    FROM
      transacao
      JOIN entrada
        ON entrada.cod_empresa = transacao.cod_empresa
       AND entrada.cod_entrada = transacao.cod_transacao
      JOIN transacao_item
        ON transacao_item.cod_transacao = transacao.cod_transacao
       AND transacao_item.cod_empresa = transacao.cod_empresa
      JOIN naturezaoperacao
        ON naturezaoperacao.cod_naturezaoperacao = transacao_item.cod_naturezaoperacao
    WHERE
      naturezaoperacao.tipo = 2
    GROUP BY
      1, 2
  ),

  tbUltimoCusto AS (
    SELECT
      transacao_item.cod_item AS cod_produto,
      transacao.cod_empresa,
      MAX(
        (transacao_item.total - transacao_item.valordesconto - transacao_item.totalipi)
        / NULLIF(transacao_item.quantidade, 0)
      ) AS custo_unitario
    FROM
      transacao
      JOIN entrada
        ON entrada.cod_empresa = transacao.cod_empresa
       AND entrada.cod_entrada = transacao.cod_transacao
      JOIN transacao_item
        ON transacao_item.cod_transacao = transacao.cod_transacao
       AND transacao_item.cod_empresa = transacao.cod_empresa
      JOIN naturezaoperacao
        ON naturezaoperacao.cod_naturezaoperacao = transacao_item.cod_naturezaoperacao
    WHERE
      naturezaoperacao.tipo = 2
    GROUP BY
      1, 2
  ),

  tbUltimaVenda AS (
    SELECT
      transacao_item.cod_item AS cod_produto,
      transacao.cod_empresa,
      MAX(transacao.dataencerramento) AS data_ultima_venda
    FROM
      transacao
      JOIN transacao_item
        ON transacao_item.cod_transacao = transacao.cod_transacao
       AND transacao_item.cod_empresa = transacao.cod_empresa
      JOIN naturezaoperacao
        ON naturezaoperacao.cod_naturezaoperacao = transacao_item.cod_naturezaoperacao
    WHERE
      naturezaoperacao.tipo = 1
    GROUP BY
      1, 2
  )

SELECT
  tbEMPRESA.EMPRESA                               AS empresa_nome,
  tbestoque.cod_empresa                           AS cod_empresa,

  COALESCE(pessoafornecedor.cod_pessoa, 0)        AS fornecedor_cod_pessoa,
  COALESCE(pessoafornecedor.nome, 'FORNECEDOR DESCONHECIDO')
                                                  AS fornecedor_nome,

  COALESCE(tbmarcamodeloar.descricao, 'SEM MARCA') AS grife,

  produto.codigobarra                             AS codigo_barras,
  item.descricao                                  AS descricao_item,

  tbestoque.saldo                                 AS quantidade_estoque,
  COALESCE(tbUltimoCusto.custo_unitario, 0)       AS preco_custo,

  tbUltimaEntrada.data_ultima_entrada             AS data_ultima_entrada,
  tbUltimaVenda.data_ultima_venda                 AS data_ultima_venda,
  CASE
    WHEN tbUltimaVenda.data_ultima_venda IS NULL THEN NULL
    ELSE DATEDIFF(DAY FROM tbUltimaVenda.data_ultima_venda TO CURRENT_DATE)
  END                                             AS dias_sem_venda,

  otiprodutoarmacao.cod_produtoarmacao            AS cod_armacao

FROM
  item
  JOIN produto
    ON produto.cod_produto = item.cod_item
  JOIN tbestoque
    ON tbestoque.cod_produto = produto.cod_produto
  JOIN tbEMPRESA
    ON tbEMPRESA.cod_empresa = tbestoque.cod_empresa
  LEFT JOIN fornecedor_item
    ON fornecedor_item.cod_item = item.cod_item
  LEFT JOIN pessoa pessoafornecedor
    ON pessoafornecedor.cod_pessoa = fornecedor_item.cod_fornecedor
  LEFT JOIN tbmarcamodeloar
    ON tbmarcamodeloar.cod_item = item.cod_item
  LEFT JOIN tbUltimaEntrada
    ON tbUltimaEntrada.cod_produto = produto.cod_produto
   AND tbUltimaEntrada.cod_empresa = tbestoque.cod_empresa
  LEFT JOIN tbUltimoCusto
    ON tbUltimoCusto.cod_produto = produto.cod_produto
   AND tbUltimoCusto.cod_empresa = tbestoque.cod_empresa
  LEFT JOIN tbUltimaVenda
    ON tbUltimaVenda.cod_produto = produto.cod_produto
   AND tbUltimaVenda.cod_empresa = tbestoque.cod_empresa
  LEFT JOIN otiprodutoarmacao
    ON otiprodutoarmacao.cod_produtoarmacao = item.cod_item

WHERE
  tbestoque.cod_empresa = CAST(? AS INTEGER)
;
