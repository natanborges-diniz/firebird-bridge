-- queries/estoque/estoque_ultimo_custo.sql
-- Retorna custo da compra mais recente por SKU em estoque.
-- Fallback: se não houver NFe (tipo=2), usa precocusto do ESTOQUELOG mais recente.
-- SKUs sem nenhum histórico retornam custo NULL e origem_custo NULL.
--
-- Parâmetros:
--   1) empresa (int)

WITH
  tbestoque AS (
    SELECT
      estoque.cod_empresa,
      estoque.cod_produto
    FROM estoque
    WHERE estoque.cod_empresa = CAST(? AS INTEGER)
      AND estoque.cod_estoquelocal = 1
      AND estoque.saldo > 0
    GROUP BY 1, 2
  ),

  tbEntradas AS (
    SELECT
      ti.cod_item                    AS cod_produto,
      t.cod_empresa,
      NULLIF(ti.valorunitario, 0)    AS custo_ultima_compra,
      t.dataencerramento             AS data_ultima_compra,
      ROW_NUMBER() OVER (
        PARTITION BY ti.cod_item, t.cod_empresa
        ORDER BY t.dataencerramento DESC NULLS LAST,
                 t.cod_transacao     DESC
      ) AS rn
    FROM transacao t
    JOIN entrada e
      ON e.cod_empresa = t.cod_empresa
     AND e.cod_entrada = t.cod_transacao
    JOIN transacao_item ti
      ON ti.cod_transacao = t.cod_transacao
     AND ti.cod_empresa   = t.cod_empresa
    JOIN tbestoque
      ON tbestoque.cod_produto = ti.cod_item
     AND tbestoque.cod_empresa = t.cod_empresa
    JOIN naturezaoperacao nat
      ON nat.cod_naturezaoperacao = ti.cod_naturezaoperacao
    WHERE nat.tipo = 2
  ),

  tbCustoLog AS (
    SELECT
      el.cod_produto,
      el.cod_empresa,
      NULLIF(el.precocusto, 0)       AS custo_estoquelog,
      el.data                        AS data_estoquelog,
      ROW_NUMBER() OVER (
        PARTITION BY el.cod_produto, el.cod_empresa
        ORDER BY el.data DESC NULLS LAST,
                 el.cod_estoquelog DESC
      ) AS rn
    FROM estoquelog el
    JOIN tbestoque
      ON tbestoque.cod_produto = el.cod_produto
     AND tbestoque.cod_empresa = el.cod_empresa
    WHERE el.precocusto > 0
  )

SELECT
  tbestoque.cod_produto                                                        AS cod_sku,
  COALESCE(tbEntradas.custo_ultima_compra, tbCustoLog.custo_estoquelog)        AS custo_ultima_compra,
  COALESCE(tbEntradas.data_ultima_compra,  tbCustoLog.data_estoquelog)         AS data_ultima_compra,
  CASE
    WHEN tbEntradas.custo_ultima_compra IS NOT NULL THEN 'NFE'
    WHEN tbCustoLog.custo_estoquelog    IS NOT NULL THEN 'ESTOQUELOG'
    ELSE NULL
  END                                                                          AS origem_custo
FROM tbestoque
LEFT JOIN tbEntradas
  ON tbEntradas.cod_produto = tbestoque.cod_produto
 AND tbEntradas.cod_empresa = tbestoque.cod_empresa
 AND tbEntradas.rn = 1
LEFT JOIN tbCustoLog
  ON tbCustoLog.cod_produto = tbestoque.cod_produto
 AND tbCustoLog.cod_empresa = tbestoque.cod_empresa
 AND tbCustoLog.rn = 1
ORDER BY tbestoque.cod_produto ASC
