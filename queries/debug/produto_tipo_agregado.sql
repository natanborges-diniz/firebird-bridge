-- queries/debug/produto_tipo_agregado.sql
-- [INVESTIGACAO] Distribuicao de cod_produto_tipo agregada nas 12 lojas Diniz.
-- Universo: prateleira (cod_estoquelocal = 1), saldo > 0.
-- Empresas: 1,2,4,6,9,10,13,14,15,16,17,18 (mapa Primitiva I..Super Shopping).
-- Nenhum parametro.
SELECT
  produto.cod_produto_tipo                     AS cod_produto_tipo,
  COUNT(DISTINCT estoque.cod_produto)          AS skus_distintos,
  COUNT(*)                                     AS linhas_estoque,
  SUM(estoque.saldo)                           AS total_pecas
FROM
  estoque
  JOIN produto ON produto.cod_produto = estoque.cod_produto
WHERE
  estoque.saldo > 0
  AND estoque.cod_estoquelocal = 1
  AND estoque.cod_empresa IN (1,2,4,6,9,10,13,14,15,16,17,18)
GROUP BY
  produto.cod_produto_tipo
ORDER BY
  total_pecas DESC
;
