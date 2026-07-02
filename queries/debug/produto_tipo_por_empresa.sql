-- queries/debug/produto_tipo_por_empresa.sql
-- [INVESTIGACAO] Distribuicao de cod_produto_tipo em estoque de UMA empresa.
-- Contexto: mapear quais tipos existem para decidir filtro de sync
-- (revenda x insumo/expediente). Universo: prateleira (cod_estoquelocal = 1).
-- Parametros:
--   1) cod_empresa (INTEGER)
SELECT
  produto.cod_produto_tipo                     AS cod_produto_tipo,
  COUNT(DISTINCT estoque.cod_produto)          AS skus_distintos,
  SUM(estoque.saldo)                           AS total_pecas
FROM
  estoque
  JOIN produto ON produto.cod_produto = estoque.cod_produto
WHERE
  estoque.cod_empresa = CAST(? AS INTEGER)
  AND estoque.cod_estoquelocal = 1
  AND estoque.saldo > 0
GROUP BY
  produto.cod_produto_tipo
ORDER BY
  skus_distintos DESC,
  total_pecas DESC
;
