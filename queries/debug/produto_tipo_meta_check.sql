-- queries/debug/produto_tipo_meta_check.sql
-- [INVESTIGACAO] Verifica se existe uma tabela de metadata para cod_produto_tipo.
-- Firebird armazena nomes de tabela sem system flag em rdb$relations.
-- Nenhum parametro.
SELECT
  TRIM(rdb$relation_name) AS nome
FROM
  rdb$relations
WHERE
  rdb$system_flag = 0
  AND UPPER(TRIM(rdb$relation_name)) IN (
    'PRODUTO_TIPO',
    'PRODUTOTIPO',
    'TIPO_PRODUTO',
    'TIPOPRODUTO',
    'DWPRODUTO_TIPO',
    'DWPRODUTOTIPO'
  )
;
