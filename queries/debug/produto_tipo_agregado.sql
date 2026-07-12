-- queries/debug/produto_tipo_agregado.sql (rota /debug/produto-tipo-map/locais)
-- [INVESTIGACAO] Valores distintos de PRODUTO.MOVIMENTAESTOQUE com contagem.
-- Confirma se e T/F, S/N, 1/0.
-- Nenhum parametro.
SELECT
  CAST(produto.movimentaestoque AS VARCHAR(4) CHARACTER SET NONE)  AS valor,
  COUNT(*)                                                         AS produtos
FROM
  produto
GROUP BY
  produto.movimentaestoque
ORDER BY
  produtos DESC
;
