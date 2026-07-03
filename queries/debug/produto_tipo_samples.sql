-- queries/debug/produto_tipo_samples.sql
-- [INVESTIGACAO] Achar o SKU "CABO PP" (insumo conhecido) e trazer todas as
-- classificacoes que ele tem. Vai revelar qual dwitemclassificacao separa
-- revenda de insumo.
-- Nenhum parametro.
SELECT FIRST 20
  item.cod_item                                         AS cod_sku,
  item.descricao                                        AS descricao,
  dwitemclassificacao.cod_dwitemclassificacao           AS cod_dw,
  dwitemclassificacao.descricao                         AS categoria,
  itemclassificacao.cod_itemclassificacao               AS cod_valor,
  itemclassificacao.descricao                           AS valor
FROM
  item
  LEFT JOIN item_itemclassificacao
    ON item_itemclassificacao.cod_item = item.cod_item
  LEFT JOIN itemclassificacao
    ON itemclassificacao.cod_itemclassificacao = item_itemclassificacao.cod_itemclassificacao
  LEFT JOIN dwitemclassificacao
    ON dwitemclassificacao.cod_dwitemclassificacao = itemclassificacao.cod_dwitemclassificacao
WHERE
  UPPER(item.descricao) LIKE 'CABO PP%'
ORDER BY
  item.cod_item,
  dwitemclassificacao.cod_dwitemclassificacao
;
