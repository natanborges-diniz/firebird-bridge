-- queries/debug/produto_tipo_agregado.sql (rota /debug/produto-tipo-map/locais)
-- [INVESTIGACAO] Ponto 1: tabelas cujo nome contem TIPO/CATEGORIA/CLASSIF/
-- NATUREZA. Vamos ver se tem tabela oficial de metadata pros produtotipos.
-- Nenhum parametro.
SELECT
  TRIM(rdb$relation_name)                       AS tabela
FROM
  rdb$relations
WHERE
  rdb$system_flag = 0
  AND (
    UPPER(TRIM(rdb$relation_name)) LIKE '%TIPO%'
    OR UPPER(TRIM(rdb$relation_name)) LIKE '%CATEGORIA%'
    OR UPPER(TRIM(rdb$relation_name)) LIKE '%CLASSIF%'
    OR UPPER(TRIM(rdb$relation_name)) LIKE '%NATUREZA%'
  )
ORDER BY
  tabela
;
