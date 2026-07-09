-- queries/debug/produto_tipo_samples.sql
-- [INVESTIGACAO] 3 SKUs exemplo por COD_PRODUTOTIPO nas 12 lojas.
-- descricao com CAST para VARCHAR(200) CHARACTER SET NONE pra evitar
-- erro de transliteracao em items com caracter fora do WIN1252.
-- Nenhum parametro.
WITH
  tbestoque AS (
    SELECT
      estoque.cod_produto,
      SUM(estoque.saldo) AS total_pecas
    FROM
      estoque
    WHERE
      estoque.saldo > 0
      AND estoque.cod_estoquelocal = 1
      AND estoque.cod_empresa IN (1,2,4,6,9,10,13,14,15,16,17,18)
    GROUP BY
      estoque.cod_produto
  ),
  tbBase AS (
    SELECT
      produto.cod_produtotipo,
      produto.cod_produto,
      CAST(item.descricao AS VARCHAR(200) CHARACTER SET NONE) AS descricao,
      tbestoque.total_pecas,
      ROW_NUMBER() OVER (
        PARTITION BY produto.cod_produtotipo
        ORDER BY tbestoque.total_pecas DESC, produto.cod_produto ASC
      ) AS rn
    FROM
      tbestoque
      JOIN produto ON produto.cod_produto = tbestoque.cod_produto
      JOIN item    ON item.cod_item       = produto.cod_produto
  )
SELECT
  tbBase.cod_produtotipo,
  tbBase.rn                       AS rank,
  tbBase.cod_produto              AS cod_sku,
  tbBase.descricao,
  tbBase.total_pecas
FROM
  tbBase
WHERE
  tbBase.rn <= 3
ORDER BY
  tbBase.cod_produtotipo,
  tbBase.rn
;
