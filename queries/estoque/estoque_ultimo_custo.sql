-- queries/estoque/estoque_ultimo_custo.sql
-- Retorna o valorunitario da entrada mais recente (naturezaoperacao.tipo=2)
-- por SKU em estoque. SKUs sem histórico de entrada retornam NULL.
--
-- Diferença crítica em relação ao tbUltimoCusto de estoque_completo.sql:
-- aquele usa MAX(valor) — maior preço histórico.
-- Este usa ROW_NUMBER() por data DESC — preço da compra mais recente.
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
    JOIN naturezaoperacao no
      ON no.cod_naturezaoperacao = ti.cod_naturezaoperacao
    WHERE no.tipo = 2
  )

SELECT
  tbestoque.cod_produto        AS cod_sku,
  tbEntradas.custo_ultima_compra,
  tbEntradas.data_ultima_compra
FROM tbestoque
LEFT JOIN tbEntradas
  ON tbEntradas.cod_produto = tbestoque.cod_produto
 AND tbEntradas.cod_empresa = tbestoque.cod_empresa
 AND tbEntradas.rn = 1
ORDER BY tbestoque.cod_produto ASC
