-- queries/vendas/analise_sku.sql
-- Vendas por empresa e SKU (item) com estoque e dados de compra
-- Parâmetros:
--   1) empresa (int) para giro real
--   2) empresa (int) para giro real (repetido p/ regra 13/18)
--   3) dataInicio (date) para giro real
--   4) dataFim (date) para giro real
--   5) empresa (int)
--   6) empresa (int) (repetido p/ regra 13/18)
--   7) dataInicio (date)
--   8) dataFim (date)

WITH
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

  tbUltimaVenda AS (
    SELECT
      transacao_item.cod_item AS cod_item,
      transacao.cod_empresa   AS cod_empresa,
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

  tbUltimoCusto AS (
    SELECT
      transacao_item.cod_item AS cod_item,
      transacao.cod_empresa   AS cod_empresa,
      MAX(transacao.dataencerramento) AS data_ultima_entrada,
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

  tbGiroAnaliseBase AS (
    SELECT
      t_giro.cod_empresaestoque AS cod_empresa,
      ti_giro.cod_item,
      t_giro.dataencerramento AS data_venda,
      ti_giro.quantidade,
      (
        SELECT FIRST 1
          transacao_entrada.dataencerramento
        FROM
          transacao transacao_entrada
          JOIN entrada
            ON entrada.cod_empresa = transacao_entrada.cod_empresa
           AND entrada.cod_entrada = transacao_entrada.cod_transacao
          JOIN transacao_item ti_entrada
            ON ti_entrada.cod_transacao = transacao_entrada.cod_transacao
           AND ti_entrada.cod_empresa = transacao_entrada.cod_empresa
          JOIN naturezaoperacao nat_entrada
            ON nat_entrada.cod_naturezaoperacao = ti_entrada.cod_naturezaoperacao
        WHERE
          nat_entrada.tipo = 2
          AND transacao_entrada.cod_empresa = t_giro.cod_empresaestoque
          AND ti_entrada.cod_item = ti_giro.cod_item
          AND transacao_entrada.dataencerramento <= t_giro.dataencerramento
        ORDER BY
          transacao_entrada.dataencerramento DESC
      ) AS data_entrada_referencia
    FROM
      transacao t_giro
      JOIN transacao_item ti_giro
        ON t_giro.cod_transacao = ti_giro.cod_transacao
       AND t_giro.cod_empresa = ti_giro.cod_empresa
      JOIN naturezaoperacao nat_giro
        ON ti_giro.cod_naturezaoperacao = nat_giro.cod_naturezaoperacao
      JOIN saida s_giro
        ON s_giro.cod_saida = t_giro.cod_transacao
       AND s_giro.cod_empresa = t_giro.cod_empresa
      JOIN empresa emp_giro
        ON emp_giro.cod_empresa = t_giro.cod_empresaestoque
    WHERE
      emp_giro.cod_empresa NOT IN (3, 5, 7, 8, 11, 12)
      AND nat_giro.tipo = 1
      AND (
        emp_giro.cod_empresa = CAST(? AS INTEGER)
        OR (
          CAST(? AS INTEGER) IN (13, 18)
          AND emp_giro.cod_empresa IN (13, 18)
        )
      )
      AND t_giro.dataencerramento BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
  ),

  tbGiroAnaliseCalc AS (
    SELECT
      tbGiroAnaliseBase.cod_empresa,
      tbGiroAnaliseBase.cod_item,
      tbGiroAnaliseBase.data_venda,
      tbGiroAnaliseBase.quantidade,
      DATEDIFF(DAY FROM tbGiroAnaliseBase.data_entrada_referencia TO tbGiroAnaliseBase.data_venda) AS dias_giro
    FROM
      tbGiroAnaliseBase
    WHERE
      tbGiroAnaliseBase.data_entrada_referencia IS NOT NULL
  ),

  tbGiroAnaliseRank AS (
    SELECT
      tbGiroAnaliseCalc.*,
      ROW_NUMBER() OVER (
        PARTITION BY tbGiroAnaliseCalc.cod_empresa, tbGiroAnaliseCalc.cod_item
        ORDER BY
          tbGiroAnaliseCalc.data_venda DESC
      ) AS rn_ultima_venda
    FROM
      tbGiroAnaliseCalc
  ),

  tbGiroAnaliseSku AS (
    SELECT
      tbGiroAnaliseRank.cod_empresa,
      tbGiroAnaliseRank.cod_item,
      SUM(CAST(tbGiroAnaliseRank.dias_giro AS DOUBLE PRECISION) * tbGiroAnaliseRank.quantidade)
        / NULLIF(SUM(tbGiroAnaliseRank.quantidade), 0) AS dias_giro_medio,
      MEDIAN(tbGiroAnaliseRank.dias_giro) AS dias_giro_mediano,
      MAX(
        CASE
          WHEN tbGiroAnaliseRank.rn_ultima_venda = 1 THEN tbGiroAnaliseRank.dias_giro
          ELSE NULL
        END
      ) AS dias_giro_ultima_peca,
      SUM(tbGiroAnaliseRank.quantidade) AS pecas_vendidas_consideradas
    FROM
      tbGiroAnaliseRank
    GROUP BY
      1, 2
  )

SELECT
  t.COD_EMPRESAESTOQUE        AS COD_EMPRESA,
  pesEmp.NOME                 AS EMPRESA,

  CASE
    WHEN emp.COD_EMPRESA IN (13, 18) THEN 13
    ELSE emp.COD_EMPRESA
  END                         AS EMPRESA_COD_LOGICO,

  CASE
    WHEN emp.COD_EMPRESA IN (13, 18) THEN 'DINIZ SUPER'
    ELSE pesEmp.NOME
  END                         AS EMPRESA_NOME_LOGICO,

  it.COD_ITEM                 AS COD_SKU,
  it.DESCRICAO                AS DESCRICAO_ITEM,
  p.CODIGOBARRA               AS CODIGO_BARRAS,
  tbmarcamodeloar.descricao   AS MARCA,
  pessoafornecedor.nome       AS FORNECEDOR,
  COALESCE(pf.COD_PRODUTOFAMILIA, ti.COD_PRODUTOFAMILIA, p.COD_PRODUTOFAMILIA)
                               AS TIPO_COD,
  COALESCE(
    pf.DESCRICAO,
    CASE
      WHEN otiprodutoarmacao.cod_produtoarmacao IS NOT NULL THEN 'AR'
      ELSE NULL
    END,
    'OUTROS'
  )                           AS TIPO,
  CASE
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'OC' THEN 'AR_SOLAR'
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'AR' THEN 'AR_RX'
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'LG' THEN 'LENTES_GRAU'
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'GC' THEN 'LENTES_CONTATO'
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'LC' THEN 'LENTES_CONTATO'
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'AC' THEN 'ACESSORIOS'
    ELSE 'OUTROS'
  END                         AS SUBCATEGORIA,
  MAX(
    CASE
      WHEN pf.DESCRICAO IN ('AR', 'OC') THEN pf.DESCRICAO
      WHEN otiprodutoarmacao.cod_produtoarmacao IS NOT NULL THEN 'AR'
      ELSE NULL
    END
  )                           AS SUBCATEGORIA_ARMACAO,
  MAX(
    CASE
      WHEN pf.DESCRICAO IN ('AR', 'OC') THEN 1
      WHEN otiprodutoarmacao.cod_produtoarmacao IS NOT NULL THEN 1
      ELSE 0
    END
  )                           AS IS_ARMACAO,

  COALESCE(tbestoque.saldo, 0) AS ESTOQUE_ATUAL,

  tbUltimaVenda.data_ultima_venda AS DATA_ULTIMA_VENDA,
  DATEDIFF(DAY FROM tbUltimaVenda.data_ultima_venda TO CURRENT_DATE)
                                AS DIAS_DESDE_ULTIMA_VENDA,
  MAX(tbGiroAnaliseSku.dias_giro_medio)
                                AS DIAS_GIRO_MEDIO,
  MAX(tbGiroAnaliseSku.dias_giro_mediano)
                                AS DIAS_GIRO_MEDIANO,
  MAX(tbGiroAnaliseSku.dias_giro_ultima_peca)
                                AS DIAS_GIRO_ULTIMA_PECA,
  COALESCE(MAX(tbGiroAnaliseSku.pecas_vendidas_consideradas), 0)
                                AS PECAS_VENDIDAS_CONSIDERADAS,

  tbUltimoCusto.data_ultima_entrada AS DATA_ULTIMO_CUSTO,
  tbUltimoCusto.custo_unitario      AS PRECO_CUSTO,

  COUNT(DISTINCT t.COD_TRANSACAO) AS QTD_TRANSACAO,
  SUM(ti.QUANTIDADE)              AS QTD_PRODUTOS,
  SUM(ti.TOTAL - ti.VALORDESCONTO - ti.TOTALIPI) AS TOTAL_VENDIDO,
  SUM(ti.TOTAL - ti.VALORDESCONTO - ti.TOTALIPI)
    / NULLIF(SUM(ti.QUANTIDADE), 0) AS PRECO_VENDA_FINAL

FROM
  TRANSACAO t
  JOIN TRANSACAO_ITEM ti
    ON t.COD_TRANSACAO = ti.COD_TRANSACAO
   AND t.COD_EMPRESA   = ti.COD_EMPRESA

  JOIN NATUREZAOPERACAO nat
    ON ti.COD_NATUREZAOPERACAO = nat.COD_NATUREZAOPERACAO

  JOIN SAIDA s
    ON s.COD_SAIDA    = t.COD_TRANSACAO
   AND s.COD_EMPRESA  = t.COD_EMPRESA

  JOIN EMPRESA emp
    ON emp.COD_EMPRESA = t.COD_EMPRESAESTOQUE

  JOIN PESSOA pesEmp
    ON pesEmp.COD_PESSOA = emp.COD_EMPRESA

  JOIN ITEM it
    ON it.COD_ITEM = ti.COD_ITEM

  JOIN PRODUTO p
    ON p.COD_PRODUTO = it.COD_ITEM

  LEFT JOIN PRODUTOFAMILIA pf
    ON pf.COD_PRODUTOFAMILIA = COALESCE(ti.COD_PRODUTOFAMILIA, p.COD_PRODUTOFAMILIA)

  LEFT JOIN otiprodutoarmacao
    ON otiprodutoarmacao.cod_produtoarmacao = it.cod_item

  LEFT JOIN tbmarcamodeloar
    ON tbmarcamodeloar.cod_item = it.cod_item

  LEFT JOIN fornecedor_item
    ON fornecedor_item.cod_item = it.cod_item

  LEFT JOIN pessoa pessoafornecedor
    ON pessoafornecedor.cod_pessoa = fornecedor_item.cod_fornecedor

  LEFT JOIN tbestoque
    ON tbestoque.cod_produto = p.cod_produto
   AND tbestoque.cod_empresa = t.cod_empresaestoque

  LEFT JOIN tbUltimaVenda
    ON tbUltimaVenda.cod_item = it.cod_item
   AND tbUltimaVenda.cod_empresa = t.cod_empresa

  LEFT JOIN tbUltimoCusto
    ON tbUltimoCusto.cod_item = it.cod_item
   AND tbUltimoCusto.cod_empresa = t.cod_empresa

  LEFT JOIN tbGiroAnaliseSku
    ON tbGiroAnaliseSku.cod_item = it.cod_item
   AND tbGiroAnaliseSku.cod_empresa = t.cod_empresaestoque

WHERE
  emp.COD_EMPRESA NOT IN (3, 5, 7, 8, 11, 12)
  AND nat.TIPO = 1

  AND (
    emp.COD_EMPRESA = CAST(? AS INTEGER)
    OR (
      CAST(? AS INTEGER) IN (13, 18)
      AND emp.COD_EMPRESA IN (13, 18)
    )
  )

  AND t.DATAENCERRAMENTO BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)

GROUP BY
  t.COD_EMPRESAESTOQUE,
  pesEmp.NOME,
  emp.COD_EMPRESA,
  it.COD_ITEM,
  it.DESCRICAO,
  p.CODIGOBARRA,
  tbmarcamodeloar.descricao,
  pessoafornecedor.nome,
  COALESCE(pf.COD_PRODUTOFAMILIA, ti.COD_PRODUTOFAMILIA, p.COD_PRODUTOFAMILIA),
  pf.COD_PRODUTOFAMILIA,
  COALESCE(
    pf.DESCRICAO,
    CASE
      WHEN otiprodutoarmacao.cod_produtoarmacao IS NOT NULL THEN 'AR'
      ELSE NULL
    END,
    'OUTROS'
  ),
  CASE
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'OC' THEN 'AR_SOLAR'
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'AR' THEN 'AR_RX'
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'LG' THEN 'LENTES_GRAU'
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'GC' THEN 'LENTES_CONTATO'
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'LC' THEN 'LENTES_CONTATO'
    WHEN UPPER(TRIM(it.DESCRICAO)) STARTING WITH 'AC' THEN 'ACESSORIOS'
    ELSE 'OUTROS'
  END,
  pf.DESCRICAO,
  tbestoque.saldo,
  tbUltimaVenda.data_ultima_venda,
  tbUltimoCusto.data_ultima_entrada,
  tbUltimoCusto.custo_unitario

ORDER BY
  EMPRESA_COD_LOGICO,
  it.DESCRICAO;
