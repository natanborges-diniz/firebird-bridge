-- queries/estoque/analise_estoque_acao.sql
-- Analise de estoque por empresa, fornecedor, grife, produto e acao sugerida.
-- Parametros:
--   1) cod_empresa (INTEGER)

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
            estoque.cod_estoquelocal IN (1, 8)
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

    tbDataUltimaentrada AS (
        SELECT
            transacao_item.cod_item AS cod_produto,
            transacao.cod_empresa,
            MAX(transacao.dataencerramento) AS data
        FROM
            transacao
            JOIN entrada
              ON entrada.cod_empresa = transacao.cod_empresa
             AND entrada.cod_entrada = transacao.cod_transacao
            JOIN transacao_item
              ON transacao_item.cod_transacao = transacao.cod_transacao
            JOIN naturezaoperacao
              ON naturezaoperacao.cod_naturezaoperacao = transacao_item.cod_naturezaoperacao
        WHERE
            naturezaoperacao.tipo = 2
        GROUP BY
            1, 2
    ),

    tbCAFproduto AS (
        SELECT
            transacao_item.cod_item AS cod_produto,
            SUM(transacao_item.quantidade - ordemcompra_item.quantidadeentregue) AS CAF
        FROM
            transacao
            JOIN ordemcompra
              ON ordemcompra.cod_ordemcompra = transacao.cod_transacao
             AND ordemcompra.cod_empresa = transacao.cod_empresa
            JOIN transacao_item
              ON transacao_item.cod_transacao = ordemcompra.cod_ordemcompra
             AND transacao_item.cod_empresa = ordemcompra.cod_empresa
            JOIN ordemcompra_item
              ON ordemcompra_item.cod_transacao = transacao_item.cod_transacao
             AND ordemcompra_item.cod_empresa = transacao_item.cod_empresa
             AND ordemcompra_item.cod_transacaoitem = transacao_item.cod_transacaoitem
        WHERE
            transacao.situacao = 2
        GROUP BY
            1
    )

SELECT
    tbEMPRESA.EMPRESA,
    pessoafornecedor.cod_pessoa,
    pessoafornecedor.nome AS nome_fornecedor,
    tbmarcamodeloar.descricao AS grife,
    produto.codigobarra AS codigo_barra,
    item.descricao AS descricao_produto,
    otiprodutoarmacao.tipo AS tipo_armacao,
    tbestoque.saldo AS quantidade_estoque,
    tbCAFproduto.CAF AS caf,
    tbDataUltimaentrada.data AS data_ultima_entrada,
    DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE) AS dias_estoque,
    CASE
        WHEN tbDataUltimaentrada.data IS NULL THEN 'SEM MOVIMENTO'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE) BETWEEN 0 AND 90 THEN 'ANALISE PARA RECOMPRA'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE) BETWEEN 91 AND 180 THEN 'ACOMPANHAMENTO'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE) BETWEEN 181 AND 270 THEN 'SINAL DE ALERTA'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE) BETWEEN 271 AND 360 THEN 'LIQUIDA 20%'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE) BETWEEN 361 AND 720 THEN 'LIQUIDA 30%'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE) > 720 THEN 'LIQUIDA 50%'
        ELSE 'DADOS INSUFICIENTES'
    END AS acao_sugerida
FROM
    item
    JOIN produto
      ON produto.cod_produto = item.cod_item
    JOIN otiprodutoarmacao
      ON otiprodutoarmacao.cod_produtoarmacao = item.cod_item
    JOIN tbestoque
      ON tbestoque.cod_produto = produto.cod_produto
    JOIN tbEMPRESA
      ON tbEMPRESA.cod_empresa = tbestoque.cod_empresa
    JOIN fornecedor_item
      ON fornecedor_item.cod_item = item.cod_item
    JOIN pessoa pessoafornecedor
      ON pessoafornecedor.cod_pessoa = fornecedor_item.cod_fornecedor
    LEFT JOIN tbmarcamodeloar
      ON tbmarcamodeloar.cod_item = item.cod_item
    LEFT JOIN tbDataUltimaentrada
      ON tbDataUltimaentrada.cod_produto = produto.cod_produto
     AND tbDataUltimaentrada.cod_empresa = tbestoque.cod_empresa
    LEFT JOIN tbCAFproduto
      ON tbCAFproduto.cod_produto = produto.cod_produto
WHERE
    tbestoque.cod_empresa = ?  -- cod_empresa (parametro)
;
