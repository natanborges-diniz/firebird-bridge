-- queries/estoque/estoque_completo.sql
-- Estoque completo (apenas prateleira) com dados de venda e custo.
-- Contrato: uma linha por cod_sku. O estoque já vem consolidado por produto
-- em tbestoque; portanto, não deve ser somado novamente por vínculo de fornecedor.
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
  ),

  tbFornecedorPreferencial AS (
    SELECT
      fornecedor_rank.cod_item,
      fornecedor_rank.cod_fornecedor,
      fornecedor_rank.nome
    FROM (
      SELECT
        fornecedor_item.cod_item,
        fornecedor_item.cod_fornecedor,
        pessoafornecedor.nome,
        ROW_NUMBER() OVER (
          PARTITION BY fornecedor_item.cod_item
          ORDER BY
            pessoafornecedor.nome ASC,
            fornecedor_item.cod_fornecedor ASC
        ) AS rn
      FROM
        fornecedor_item
        JOIN pessoa pessoafornecedor
          ON pessoafornecedor.cod_pessoa = fornecedor_item.cod_fornecedor
    ) fornecedor_rank
    WHERE
      fornecedor_rank.rn = 1
  ),

  tbEstoqueCompletoBase AS (
    SELECT
      produto.cod_produto                             AS cod_sku,
      produto.codigobarra                             AS codigo_barras,
      item.descricao                                  AS descricao,
      COALESCE(tbFornecedorPreferencial.nome, 'SEM FORNECEDOR')
                                                      AS fornecedor_nome,
      COALESCE(tbmarcamodeloar.descricao, 'SEM MARCA') AS grife,
      tbestoque.saldo                                 AS quantidade_estoque,
      COALESCE(tbUltimoCusto.custo_unitario, 0)       AS preco_custo,
      0                                               AS preco_venda,
      tbUltimaEntrada.data_ultima_entrada             AS data_ultima_entrada,
      tbUltimaVenda.data_ultima_venda                 AS data_ultima_venda,
      CASE
        WHEN tbUltimaEntrada.data_ultima_entrada IS NULL THEN NULL
        ELSE DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE)
      END                                             AS dias_estoque,
      CASE
        WHEN tbUltimaVenda.data_ultima_venda IS NULL THEN NULL
        ELSE DATEDIFF(DAY FROM tbUltimaVenda.data_ultima_venda TO CURRENT_DATE)
      END                                             AS dias_sem_venda,
      CASE
        WHEN tbUltimaEntrada.data_ultima_entrada IS NULL THEN 'SEM MOVIMENTO'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) BETWEEN 0 AND 90 THEN 'ANALISE PARA RECOMPRA'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) BETWEEN 91 AND 180 THEN 'ACOMPANHAMENTO'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) BETWEEN 181 AND 270 THEN 'SINAL DE ALERTA'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) BETWEEN 271 AND 360 THEN 'LIQUIDA 20%'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) BETWEEN 361 AND 720 THEN 'LIQUIDA 30%'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) > 720 THEN 'LIQUIDA 50%'
        ELSE 'DADOS INSUFICIENTES'
      END                                             AS acao_sugerida
    FROM
      item
      JOIN produto
        ON produto.cod_produto = item.cod_item
      JOIN tbestoque
        ON tbestoque.cod_produto = produto.cod_produto
      JOIN tbEMPRESA
        ON tbEMPRESA.cod_empresa = tbestoque.cod_empresa
      LEFT JOIN tbFornecedorPreferencial
        ON tbFornecedorPreferencial.cod_item = item.cod_item
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
    WHERE
      tbestoque.cod_empresa = CAST(? AS INTEGER)
  )

SELECT
  estoque_rank.cod_sku,
  estoque_rank.codigo_barras,
  estoque_rank.descricao,
  estoque_rank.fornecedor_nome,
  estoque_rank.grife,
  estoque_rank.quantidade_estoque,
  estoque_rank.preco_custo,
  estoque_rank.preco_venda,
  estoque_rank.data_ultima_entrada,
  estoque_rank.data_ultima_venda,
  estoque_rank.dias_estoque,
  estoque_rank.dias_sem_venda,
  estoque_rank.acao_sugerida
FROM (
  SELECT
    tbEstoqueCompletoBase.*,
    ROW_NUMBER() OVER (
      PARTITION BY tbEstoqueCompletoBase.cod_sku
      ORDER BY
        tbEstoqueCompletoBase.data_ultima_entrada DESC NULLS LAST,
        tbEstoqueCompletoBase.fornecedor_nome ASC
    ) AS rn
  FROM
    tbEstoqueCompletoBase
) estoque_rank
WHERE
  estoque_rank.rn = 1
ORDER BY
  estoque_rank.quantidade_estoque DESC,
  estoque_rank.cod_sku ASC
;
