-- queries/estoque/analise_estoque_acao.sql
-- Versão LIGHT: análise de estoque com ação sugerida, focando em performance.

SELECT
  -- Empresa
  e.ESTOQUECOD_EMPRESA            AS COD_EMPRESA,
  pesEmp.NOME                     AS EMPRESA,

  -- Item / produto
  e.ITEMCOD_ITEM                  AS COD_ITEM,
  e.ITEMDESCRICAO                 AS DESCRICAO_ITEM,

  -- Saldo e parâmetros de estoque
  COALESCE(e.PRODUTOSALDO, 0)     AS SALDO_ESTOQUE,
  e.PRODUTOMINIMO                 AS ESTOQUE_MINIMO,
  e.PRODUTOMAXIMO                 AS ESTOQUE_MAXIMO,

  -- Última movimentação
  e.ESTOQUEDATAULTIMAMOVIMENTACAO AS DATA_ULTIMA_MOVIMENTACAO,

  -- Dias desde a última movimentação
  CASE
    WHEN e.ESTOQUEDATAULTIMAMOVIMENTACAO IS NULL
      THEN NULL
    ELSE
      CURRENT_DATE - e.ESTOQUEDATAULTIMAMOVIMENTACAO
  END                             AS DIAS_ESTOQUE,

  -- Cobertura em relação ao mínimo
  CASE
    WHEN e.PRODUTOMINIMO IS NULL OR e.PRODUTOMINIMO <= 0 THEN NULL
    ELSE
      e.PRODUTOSALDO / e.PRODUTOMINIMO
  END                             AS COBERTURA_MINIMO,

  -- CAF (placeholder por enquanto)
  CAST(NULL AS NUMERIC(15,4))     AS CAF,

  -- Ação sugerida
  CASE
    WHEN COALESCE(e.PRODUTOSALDO, 0) <= 0 THEN 'SEM ESTOQUE'
    WHEN e.PRODUTOSALDO > 0
         AND e.PRODUTOMINIMO IS NOT NULL
         AND e.PRODUTOSALDO < e.PRODUTOMINIMO THEN 'COMPRAR'
    WHEN e.PRODUTOMAXIMO IS NOT NULL
         AND e.PRODUTOSALDO > e.PRODUTOMAXIMO THEN 'LIQUIDAR 30%'
    WHEN e.ESTOQUEDATAULTIMAMOVIMENTACAO IS NOT NULL
         AND (CURRENT_DATE - e.ESTOQUEDATAULTIMAMOVIMENTACAO) > 120 THEN 'LIQUIDAR 30%'
    ELSE 'OK'
  END                             AS ACAO_SUGERIDA

FROM
  V_ESTOQUE e
  JOIN EMPRESA emp
    ON emp.COD_EMPRESA = e.ESTOQUECOD_EMPRESA
  JOIN PESSOA pesEmp
    ON pesEmp.COD_PESSOA = emp.COD_EMPRESA

WHERE
  -- empresa obrigatória
  e.ESTOQUECOD_EMPRESA = CAST(? AS INTEGER)
  -- só itens com saldo diferente de zero (reduz MUITO o volume)
  AND COALESCE(e.PRODUTOSALDO, 0) <> 0

ORDER BY
  pesEmp.NOME,
  e.ITEMDESCRICAO;
