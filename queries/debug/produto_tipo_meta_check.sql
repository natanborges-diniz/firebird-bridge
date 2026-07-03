-- queries/debug/produto_tipo_meta_check.sql
-- [INVESTIGACAO] Todas as dwitemclassificacao existentes com contagem de
-- itens classificados. Uma dessas provavelmente eh o "tipo de produto"
-- (revenda x insumo).
-- Nenhum parametro.
SELECT
  dwitemclassificacao.cod_dwitemclassificacao         AS cod_dw,
  dwitemclassificacao.descricao                       AS descricao_dw,
  COUNT(DISTINCT itemclassificacao.cod_itemclassificacao) AS valores_distintos,
  COUNT(item_itemclassificacao.cod_item)              AS itens_classificados
FROM
  dwitemclassificacao
  LEFT JOIN itemclassificacao
    ON itemclassificacao.cod_dwitemclassificacao = dwitemclassificacao.cod_dwitemclassificacao
  LEFT JOIN item_itemclassificacao
    ON item_itemclassificacao.cod_itemclassificacao = itemclassificacao.cod_itemclassificacao
GROUP BY
  dwitemclassificacao.cod_dwitemclassificacao,
  dwitemclassificacao.descricao
ORDER BY
  itens_classificados DESC
;
