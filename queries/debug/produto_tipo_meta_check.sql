-- queries/debug/produto_tipo_meta_check.sql
-- [INVESTIGACAO] Valores da classificacao 22 ("Tipo") com contagem em estoque.
-- Universo: prateleira (cod_estoquelocal = 1), saldo > 0, 12 lojas.
-- Nenhum parametro.
SELECT
  itemclassificacao.cod_itemclassificacao       AS cod_valor,
  itemclassificacao.descricao                   AS valor,
  COUNT(DISTINCT produto.cod_produto)           AS skus_distintos,
  SUM(estoque.saldo)                            AS total_pecas
FROM
  estoque
  JOIN produto ON produto.cod_produto = estoque.cod_produto
  JOIN item_itemclassificacao
    ON item_itemclassificacao.cod_item = produto.cod_produto
  JOIN itemclassificacao
    ON itemclassificacao.cod_itemclassificacao = item_itemclassificacao.cod_itemclassificacao
WHERE
  estoque.saldo > 0
  AND estoque.cod_estoquelocal = 1
  AND estoque.cod_empresa IN (1,2,4,6,9,10,13,14,15,16,17,18)
  AND itemclassificacao.cod_dwitemclassificacao = 22
GROUP BY
  itemclassificacao.cod_itemclassificacao,
  itemclassificacao.descricao
ORDER BY
  total_pecas DESC
;
