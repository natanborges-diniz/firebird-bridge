-- queries/debug/produto_tipo_agregado.sql
-- [INVESTIGACAO] Inventario de cod_estoquelocal com contagem: quantos locais
-- existem e quanto estoque cada um segura. Serve pra entender por que
-- prateleira (1) mostra 3 tipos e "todos os locais" mostra mais.
-- Nenhum parametro.
SELECT
  estoque.cod_estoquelocal                      AS cod_estoquelocal,
  COUNT(DISTINCT estoque.cod_produto)           AS skus_distintos,
  COUNT(*)                                      AS linhas_estoque,
  SUM(estoque.saldo)                            AS total_pecas
FROM
  estoque
WHERE
  estoque.saldo > 0
  AND estoque.cod_empresa IN (1,2,4,6,9,10,13,14,15,16,17,18)
GROUP BY
  estoque.cod_estoquelocal
ORDER BY
  total_pecas DESC
;
