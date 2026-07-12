-- queries/debug/produto_tipo_meta_check.sql (rota /debug/produto-tipo-map/classif22)
-- [INVESTIGACAO] Ponto 3: distribuicao de estoque nos tipos suspeitos 1, 2, 8.
-- Se tipo 2 ou tipo 8 tiverem 0 pecas em estoque, sao ruido/dado sujo.
-- Nenhum parametro.
SELECT
  produto.cod_produtotipo                       AS cod_produtotipo,
  COUNT(DISTINCT produto.cod_produto)           AS skus_em_estoque,
  SUM(estoque.saldo)                            AS total_pecas,
  MIN(estoque.saldo)                            AS menor_saldo,
  MAX(estoque.saldo)                            AS maior_saldo,
  COUNT(DISTINCT estoque.cod_empresa)           AS empresas_afetadas
FROM
  estoque
  JOIN produto ON produto.cod_produto = estoque.cod_produto
WHERE
  produto.cod_produtotipo IN (1, 2, 8)
  AND estoque.saldo > 0
  AND estoque.cod_empresa IN (1,2,4,6,9,10,13,14,15,16,17,18)
GROUP BY
  produto.cod_produtotipo
ORDER BY
  produto.cod_produtotipo
;
