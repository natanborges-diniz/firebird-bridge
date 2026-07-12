-- queries/debug/produto_tipo_agregado.sql (rota /debug/produto-tipo-map/locais)
-- [INVESTIGACAO] Busca ampla por tabelas cujo nome contem TIPOPRODUTO,
-- PRODUTOTIPO, TBTIPO, ou DESCRICAO. Objetivo: confirmar se
-- tbtipoprodutodescricao existe sob outro nome parecido.
-- Nenhum parametro.
SELECT
  TRIM(rdb$relation_name)     AS tabela
FROM
  rdb$relations
WHERE
  rdb$system_flag = 0
  AND (
    UPPER(TRIM(rdb$relation_name)) LIKE '%TIPOPRODUTO%'
    OR UPPER(TRIM(rdb$relation_name)) LIKE '%PRODUTOTIPO%'
    OR UPPER(TRIM(rdb$relation_name)) LIKE 'TB%TIPO%'
    OR UPPER(TRIM(rdb$relation_name)) LIKE '%DESCRICAO%'
  )
ORDER BY
  tabela
;
