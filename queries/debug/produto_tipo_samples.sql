-- queries/debug/produto_tipo_samples.sql (rota /debug/produto-tipo-map/samples)
-- [INVESTIGACAO] TABELA FINAL CONSOLIDADA usando os nomes REAIS descobertos
-- na investigacao anterior:
--   - PRODUTO.COD_PRODUTOTIPO         (nao cod_produto_tipo)
--   - PRODUTO.MOVIMENTAESTOQUE = 'T' (equivalente a "permite_movimento")
--   - ITEM.ATIVO = 'T'               (equivalente a "produto_ativo")
-- Como nao existe tabela tbtipoprodutodescricao, a coluna nome_oficial
-- e derivada dos samples reportados: cesto misto, lentes, armacoes.
-- Otimizacao: agrupa estoque primeiro pra reduzir cost do JOIN.
-- Nenhum parametro.
WITH
  tbestoque AS (
    SELECT
      estoque.cod_produto,
      SUM(estoque.saldo)  AS pecas
    FROM
      estoque
    WHERE
      estoque.saldo > 0
      AND estoque.cod_empresa IN (1,2,4,6,9,10,13,14,15,16,17,18)
    GROUP BY
      estoque.cod_produto
  )
SELECT
  produto.cod_produtotipo                                          AS cod_produtotipo,
  CASE produto.cod_produtotipo
    WHEN 1  THEN 'CESTO MISTO (insumo/embalagem + tratamentos de lente + servicos)'
    WHEN 7  THEN 'LENTES DE GRAU'
    WHEN 13 THEN 'ARMACOES'
    ELSE 'DESCONHECIDO'
  END                                                              AS nome_oficial,
  COUNT(*)                                                         AS skus_com_estoque,
  SUM(CASE WHEN item.ativo = 'T' THEN 1 ELSE 0 END)                AS skus_ativos,
  SUM(CASE WHEN produto.movimentaestoque = 'T' THEN 1 ELSE 0 END)  AS skus_permitem_mov,
  SUM(tbestoque.pecas)                                             AS pecas_total
FROM
  tbestoque
  JOIN produto ON produto.cod_produto = tbestoque.cod_produto
  JOIN item    ON item.cod_item       = produto.cod_produto
GROUP BY
  produto.cod_produtotipo
ORDER BY
  skus_com_estoque DESC
;
