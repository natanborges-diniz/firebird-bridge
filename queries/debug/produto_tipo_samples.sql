-- queries/debug/produto_tipo_samples.sql (rota /debug/produto-tipo-map/samples)
-- [INVESTIGACAO] Ponto 2: 15 SKUs cada de tipos 1, 2 e 8 (sem filtro de
-- estoque, pra ver quaisquer produtos cadastrados nesses tipos). CAST
-- CHARACTER SET NONE pra evitar erro de transliteracao WIN1252.
-- Nenhum parametro.
WITH
  tbBase AS (
    SELECT
      produto.cod_produtotipo,
      produto.cod_produto,
      CAST(item.descricao AS VARCHAR(200) CHARACTER SET NONE) AS descricao,
      ROW_NUMBER() OVER (
        PARTITION BY produto.cod_produtotipo
        ORDER BY produto.cod_produto ASC
      ) AS rn
    FROM
      produto
      JOIN item ON item.cod_item = produto.cod_produto
    WHERE
      produto.cod_produtotipo IN (1, 2, 8)
  )
SELECT
  tbBase.cod_produtotipo,
  tbBase.rn                       AS rank,
  tbBase.cod_produto              AS cod_sku,
  tbBase.descricao
FROM
  tbBase
WHERE
  tbBase.rn <= 15
ORDER BY
  tbBase.cod_produtotipo,
  tbBase.rn
;
