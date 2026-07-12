-- queries/debug/produto_tipo_por_empresa.sql
-- [INVESTIGACAO] PRODUTO.COD_PRODUTOTIPO nas 12 lojas, TODOS os estoquelocais.
-- Otimizacao: primeiro agrega estoque por cod_produto, depois join com produto.
-- Assim COUNT(DISTINCT) vira COUNT(*).
-- Nenhum parametro.
WITH
  tbestoque AS (
    SELECT
      estoque.cod_produto,
      SUM(estoque.saldo)  AS saldo_total,
      COUNT(*)            AS linhas
    FROM
      estoque
    WHERE
      estoque.saldo > 0
      AND estoque.cod_empresa IN (1,2,4,6,9,10,13,14,15,16,17,18)
    GROUP BY
      estoque.cod_produto
  )
SELECT
  produto.cod_produtotipo                       AS cod_produtotipo,
  COUNT(*)                                      AS skus_distintos,
  SUM(tbestoque.linhas)                         AS linhas_estoque,
  SUM(tbestoque.saldo_total)                    AS total_pecas
FROM
  tbestoque
  JOIN produto ON produto.cod_produto = tbestoque.cod_produto
GROUP BY
  produto.cod_produtotipo
ORDER BY
  total_pecas DESC
;
