-- queries/estoque/estoque_completo.sql
-- Estoque completo (apenas prateleira) com dados de venda e custo.
-- Contrato: uma linha por cod_sku. O estoque já vem consolidado por produto
-- em tbestoque; portanto, não deve ser somado novamente por vínculo de fornecedor.
-- Performance: o filtro de empresa é aplicado em tbestoque antes de qualquer
-- window function para evitar ranquear vínculos do catálogo inteiro.
-- Parâmetros:
--   1) empresa (int)

WITH
  tbestoque AS (
    SELECT
      estoque.cod_empresa,
      estoque.cod_produto,
      SUM(estoque.saldo) AS saldo
    FROM
      estoque
    WHERE
      estoque.cod_empresa = CAST(? AS INTEGER)
      AND estoque.cod_estoquelocal = 1
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
      JOIN tbestoque
        ON tbestoque.cod_produto = item_itemclassificacao.cod_item
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
      JOIN tbestoque
        ON tbestoque.cod_produto = transacao_item.cod_item
       AND tbestoque.cod_empresa = transacao.cod_empresa
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
      JOIN tbestoque
        ON tbestoque.cod_produto = transacao_item.cod_item
       AND tbestoque.cod_empresa = transacao.cod_empresa
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
      JOIN tbestoque
        ON tbestoque.cod_produto = transacao_item.cod_item
       AND tbestoque.cod_empresa = transacao.cod_empresa
      JOIN naturezaoperacao
        ON naturezaoperacao.cod_naturezaoperacao = transacao_item.cod_naturezaoperacao
    WHERE
      naturezaoperacao.tipo = 1
    GROUP BY
      1, 2
  ),

  tbFornecedorVinculosLoja AS (
    SELECT
      fornecedor_item.cod_item,
      fornecedor_item.cod_fornecedor,
      pessoafornecedor.nome AS fornecedor_nome
    FROM
      fornecedor_item
      JOIN tbestoque
        ON tbestoque.cod_produto = fornecedor_item.cod_item
      JOIN pessoa pessoafornecedor
        ON pessoafornecedor.cod_pessoa = fornecedor_item.cod_fornecedor
  ),

  tbEstoqueCompletoBase AS (
    SELECT
      produto.cod_produto                              AS cod_sku,
      produto.codigobarra                              AS codigo_barras,
      item.descricao                                   AS descricao,
      CASE
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'LG' THEN 'LENTES'
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'GC' THEN 'LENTES'
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'LC' THEN 'LENTES'
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'OC' THEN 'ARMACOES'
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'AR' THEN 'ARMACOES'
        ELSE 'OUTROS'
      END                                              AS tipo,
      CASE
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'OC' THEN 'AR_SOLAR'
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'AR' THEN 'AR_RX'
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'LG' THEN 'LENTES_GRAU'
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'GC' THEN 'LENTES_CONTATO'
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'LC' THEN 'LENTES_CONTATO'
        WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'AC' THEN 'ACESSORIOS'
        ELSE 'OUTROS'
      END                                              AS subcategoria,
      COALESCE(tbFornecedorVinculosLoja.fornecedor_nome, 'SEM FORNECEDOR')
                                                       AS fornecedor_nome,
      COALESCE(tbmarcamodeloar.descricao, 'SEM MARCA') AS grife,
      tbestoque.saldo                                  AS quantidade_estoque,
      COALESCE(tbUltimoCusto.custo_unitario, 0)        AS preco_custo,
      0                                                AS preco_venda,
      tbUltimaEntrada.data_ultima_entrada              AS data_ultima_entrada,
      tbUltimaVenda.data_ultima_venda                  AS data_ultima_venda,
      CAST(NULL AS INTEGER)                            AS dias_giro_medio,
      CAST(NULL AS INTEGER)                            AS dias_giro_mediano,
      CAST(NULL AS INTEGER)                            AS dias_giro_ultima_peca,
      0                                                AS pecas_vendidas_consideradas,
      CASE
        WHEN tbUltimaEntrada.data_ultima_entrada IS NULL THEN NULL
        ELSE DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE)
      END                                              AS dias_estoque,
      CASE
        WHEN tbUltimaVenda.data_ultima_venda IS NULL THEN NULL
        ELSE DATEDIFF(DAY FROM tbUltimaVenda.data_ultima_venda TO CURRENT_DATE)
      END                                              AS dias_sem_venda,
      CASE
        WHEN tbUltimaEntrada.data_ultima_entrada IS NULL THEN 'SEM MOVIMENTO'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) BETWEEN 0 AND 90 THEN 'ANALISE PARA RECOMPRA'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) BETWEEN 91 AND 180 THEN 'ACOMPANHAMENTO'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) BETWEEN 181 AND 270 THEN 'SINAL DE ALERTA'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) BETWEEN 271 AND 360 THEN 'LIQUIDA 20%'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) BETWEEN 361 AND 720 THEN 'LIQUIDA 30%'
        WHEN DATEDIFF(DAY FROM tbUltimaEntrada.data_ultima_entrada TO CURRENT_DATE) > 720 THEN 'LIQUIDA 50%'
        ELSE 'DADOS INSUFICIENTES'
      END                                              AS acao_sugerida
    FROM
      tbestoque
      JOIN produto
        ON produto.cod_produto = tbestoque.cod_produto
      JOIN item
        ON item.cod_item = produto.cod_produto
      LEFT JOIN tbFornecedorVinculosLoja
        ON tbFornecedorVinculosLoja.cod_item = item.cod_item
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
  ),

  tbEstoqueCompletoRank AS (
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
  )

SELECT
  tbEstoqueCompletoRank.cod_sku,
  tbEstoqueCompletoRank.codigo_barras,
  tbEstoqueCompletoRank.descricao,
  tbEstoqueCompletoRank.tipo,
  tbEstoqueCompletoRank.subcategoria,
  tbEstoqueCompletoRank.fornecedor_nome,
  tbEstoqueCompletoRank.grife,
  tbEstoqueCompletoRank.quantidade_estoque,
  tbEstoqueCompletoRank.preco_custo,
  tbEstoqueCompletoRank.preco_venda,
  tbEstoqueCompletoRank.data_ultima_entrada,
  tbEstoqueCompletoRank.data_ultima_venda,
  tbEstoqueCompletoRank.dias_giro_medio,
  tbEstoqueCompletoRank.dias_giro_mediano,
  tbEstoqueCompletoRank.dias_giro_ultima_peca,
  tbEstoqueCompletoRank.pecas_vendidas_consideradas,
  tbEstoqueCompletoRank.dias_estoque,
  tbEstoqueCompletoRank.dias_sem_venda,
  tbEstoqueCompletoRank.acao_sugerida
FROM
  tbEstoqueCompletoRank
WHERE
  tbEstoqueCompletoRank.rn = 1
ORDER BY
  tbEstoqueCompletoRank.quantidade_estoque DESC,
  tbEstoqueCompletoRank.cod_sku ASC
;
