-- queries/debug/produto_tipo_por_empresa.sql
-- [INVESTIGACAO] Colunas da tabela PRODUTO no schema atual.
-- Firebird armazena metadata em rdb$relation_fields.
-- Nenhum parametro.
SELECT
  TRIM(rf.rdb$field_name) AS nome_coluna,
  rf.rdb$field_position   AS pos,
  CASE f.rdb$field_type
    WHEN 7  THEN 'SMALLINT'
    WHEN 8  THEN 'INTEGER'
    WHEN 10 THEN 'FLOAT'
    WHEN 12 THEN 'DATE'
    WHEN 13 THEN 'TIME'
    WHEN 14 THEN 'CHAR'
    WHEN 16 THEN 'BIGINT'
    WHEN 27 THEN 'DOUBLE'
    WHEN 35 THEN 'TIMESTAMP'
    WHEN 37 THEN 'VARCHAR'
    WHEN 261 THEN 'BLOB'
    ELSE CAST(f.rdb$field_type AS VARCHAR(10))
  END                     AS tipo
FROM
  rdb$relation_fields rf
  JOIN rdb$fields f ON f.rdb$field_name = rf.rdb$field_source
WHERE
  UPPER(TRIM(rf.rdb$relation_name)) = 'PRODUTO'
ORDER BY
  rf.rdb$field_position
;
