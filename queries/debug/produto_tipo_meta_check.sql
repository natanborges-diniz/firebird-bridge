-- queries/debug/produto_tipo_meta_check.sql (rota /debug/produto-tipo-map/classif22)
-- [INVESTIGACAO] Colunas de PRODUTO cujo nome contem FLAG/DESATIVADO/PERMITE/
-- MOVIMENTO/ATIVO/BLOQUEA. Serve pra confirmar/negar a existencia de
-- flag_produto_desativado e flag_permite_movimento no schema.
-- Nenhum parametro.
SELECT
  TRIM(rf.rdb$field_name)     AS nome_coluna,
  CASE f.rdb$field_type
    WHEN 7  THEN 'SMALLINT'
    WHEN 8  THEN 'INTEGER'
    WHEN 14 THEN 'CHAR'
    WHEN 16 THEN 'BIGINT'
    WHEN 37 THEN 'VARCHAR'
    ELSE CAST(f.rdb$field_type AS VARCHAR(10))
  END                         AS tipo
FROM
  rdb$relation_fields rf
  JOIN rdb$fields f ON f.rdb$field_name = rf.rdb$field_source
WHERE
  UPPER(TRIM(rf.rdb$relation_name)) IN ('PRODUTO','ITEM')
  AND (
    UPPER(TRIM(rf.rdb$field_name)) LIKE 'FLAG%'
    OR UPPER(TRIM(rf.rdb$field_name)) LIKE '%DESATIVADO%'
    OR UPPER(TRIM(rf.rdb$field_name)) LIKE '%PERMITE%'
    OR UPPER(TRIM(rf.rdb$field_name)) LIKE '%MOVIMENTO%'
    OR UPPER(TRIM(rf.rdb$field_name)) LIKE '%ATIVO%'
    OR UPPER(TRIM(rf.rdb$field_name)) LIKE '%BLOQUEA%'
  )
ORDER BY
  rf.rdb$relation_name,
  rf.rdb$field_name
;
