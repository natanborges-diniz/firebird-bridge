-- queries/debug/produto_tipo_agregado.sql
-- [INVESTIGACAO] PRODUTO.INSUMO (flag S/N) distribuido no estoque.
-- Universo: prateleira (cod_estoquelocal = 1), saldo > 0, 12 lojas.
-- Nenhum parametro.
SELECT
  COALESCE(produto.insumo, '?')                 AS insumo,
  COUNT(DISTINCT produto.cod_produto)           AS skus_distintos,
  COUNT(*)                                      AS linhas_estoque,
  SUM(estoque.saldo)                            AS total_pecas
FROM
  estoque
  JOIN produto ON produto.cod_produto = estoque.cod_produto
WHERE
  estoque.saldo > 0
  AND estoque.cod_estoquelocal = 1
  AND estoque.cod_empresa IN (1,2,4,6,9,10,13,14,15,16,17,18)
GROUP BY
  produto.insumo
ORDER BY
  total_pecas DESC
;
