-- queries/debug/produto_tipo_por_empresa.sql (rota /debug/produto-tipo-map/dist)
-- [INVESTIGACAO] Todos os cod_produtotipo distintos cadastrados em PRODUTO
-- (independente de ter estoque). Objetivo: descobrir se o schema realmente
-- tem 20 tipos ou se o cadastro so tem 3.
-- Nenhum parametro.
WITH
  tbestoque_atual AS (
    SELECT DISTINCT
      estoque.cod_produto
    FROM
      estoque
    WHERE
      estoque.saldo > 0
      AND estoque.cod_empresa IN (1,2,4,6,9,10,13,14,15,16,17,18)
  )
SELECT
  produto.cod_produtotipo                       AS cod_produtotipo,
  COUNT(*)                                      AS skus_no_cadastro,
  COUNT(tbestoque_atual.cod_produto)            AS skus_com_estoque
FROM
  produto
  LEFT JOIN tbestoque_atual
    ON tbestoque_atual.cod_produto = produto.cod_produto
GROUP BY
  produto.cod_produtotipo
ORDER BY
  produto.cod_produtotipo
;
