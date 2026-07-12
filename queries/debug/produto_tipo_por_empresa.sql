-- queries/debug/produto_tipo_por_empresa.sql (rota /debug/produto-tipo-map/dist)
-- [INVESTIGACAO] Valores distintos de ITEM.ATIVO com contagem. Confirma se
-- e T/F, S/N, 1/0 ou outra coisa.
-- Nenhum parametro.
SELECT
  CAST(item.ativo AS VARCHAR(4) CHARACTER SET NONE)  AS valor,
  COUNT(*)                                           AS itens
FROM
  item
GROUP BY
  item.ativo
ORDER BY
  itens DESC
;
