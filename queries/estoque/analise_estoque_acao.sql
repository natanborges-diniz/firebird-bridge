-- queries/estoque/analise_estoque_acao.sql
-- Análise de estoque completa (CAF, última entrada, média de venda, ação sugerida)
-- Filtro: empresa (pcod_empresa)

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
            naturezaoperacao.tipo = 2   -- entrada
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
            transacao.situacao = 2   -- aprovadas
        GROUP BY
            1
    ),

    tbMEDIAvenda AS (
        SELECT
            transacao_item.cod_item   AS cod_produto,
            transacao_item.cod_empresa,

            -- quantidades médias
            SUM(
                IIF(
                    DATEDIFF(MONTH, transacao.dataencerramento, CURRENT_DATE) = 6,
                    transacao_item.quantidade,
                    NULL
                )
            ) / 1 AS qtd_1_mes,

            SUM(
                IIF(
                    DATEDIFF(MONTH, transacao.dataencerramento, CURRENT_DATE) >= 4,
                    transacao_item.quantidade,
                    NULL
                )
            ) / 3 AS qtd_3_meses,

            SUM(transacao_item.quantidade) / 6 AS qtd_6_meses,

            -- giros médios
            COUNT(
                IIF(
                    DATEDIFF(MONTH, transacao.dataencerramento, CURRENT_DATE) = 6,
                    transacao.cod_transacao,
                    NULL
                )
            ) / 1 AS giro_1_mes,

            COUNT(
                IIF(
                    DATEDIFF(MONTH, transacao.dataencerramento, CURRENT_DATE) >= 4,
                    transacao.cod_transacao,
                    NULL
                )
            ) / 3 AS giro_3_meses

        FROM
            transacao
            JOIN saida
              ON saida.cod_empresa = transacao.cod_empresa
             AND saida.cod_saida   = transacao.cod_transacao
            JOIN venda
              ON venda.cod_empresa = transacao.cod_empresa
             AND venda.cod_venda   = transacao.cod_transacao
            JOIN transacao_item
              ON transacao_item.cod_empresa   = transacao.cod_empresa
             AND transacao_item.cod_transacao = transacao.cod_transacao
        WHERE
            transacao.dataencerramento
                BETWEEN DATEADD(-6 MONTH TO CURRENT_DATE) AND CURRENT_DATE
        GROUP BY
            1, 2
    )

SELECT
    -- empresa
    tbEMPRESA.EMPRESA                                 AS empresa_nome,

    -- fornecedor
    pessoafornecedor.cod_pessoa                       AS fornecedor_cod_pessoa,
    pessoafornecedor.nome                             AS fornecedor_nome,

    -- grife / família
    tbmarcamodeloar.descricao                         AS grife,

    -- produto
    produto.codigobarra                               AS codigo_barras,
    item.descricao                                    AS descricao_item,

    -- estoque / CAF
    tbestoque.saldo                                   AS quantidade_estoque,
    tbCAFproduto.CAF                                  AS caf,

    -- datas e dias em estoque
    tbDataUltimaentrada.data                          AS data_ultima_entrada,
    DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE)
                                                      AS dias_estoque,

    -- ação sugerida
    CASE
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE)
             BETWEEN 0 AND 90   THEN 'ANÁLISE PARA RECOMPRA'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE)
             BETWEEN 91 AND 180 THEN 'ACOMPANHAMENTO'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE)
             BETWEEN 181 AND 270 THEN 'SINAL DE ALERTA'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE)
             BETWEEN 271 AND 360 THEN 'LIQUIDA 20%'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE)
             BETWEEN 361 AND 720 THEN 'LIQUIDA 30%'
        WHEN DATEDIFF(DAY FROM tbDataUltimaentrada.data TO CURRENT_DATE)
             > 720              THEN 'LIQUIDA 50%'
        ELSE 'DADOS INSUFICIENTES'
    END                                               AS acao_sugerida

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
    LEFT JOIN tbMEDIAvenda
      ON tbMEDIAvenda.cod_produto = produto.cod_produto
     AND tbMEDIAvenda.cod_empresa = tbestoque.cod_empresa

WHERE
    tbestoque.cod_empresa = CAST(? AS INTEGER)
;
