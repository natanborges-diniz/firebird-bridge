-- queries/estoque/analise_estoque_acao.sql
-- Análise de estoque com ação sugerida por item / fornecedor.
-- Base: V_ESTOQUE + V_FORNECEDORITEM
-- Filtro: empresa (ESTOQUECOD_EMPRESA)

SELECT
  -- Empresa física
  e.ESTOQUECOD_EMPRESA        AS COD_EMPRESA,
  pesEmp.NOME                 AS EMPRESA,

  -- Produto / item
  e.ITEMCOD_ITEM              AS COD_ITEM,
  e.ITEMDESCRICAO             AS DESCRICAO_ITEM,

  -- Fornecedor (via view de fornecedor x item)
  vf.COD_FORNECEDOR           AS COD_PESSOA,
  vf.NOME_FORNECEDOR          AS NOME_FORNECEDOR,

  -- Saldo e parâmetros de estoque
  COALESCE(e.PRODUTOSALDO, 0) AS SALDO_ESTOQUE,
  e.PRODUTOMINIMO             AS ESTOQUE_MINIMO,
  e.PRODUTOMAXIMO             AS ESTOQUE_MAXIMO,

  -- Última movimentação
  e.ESTOQUEDATAULTIMAMOVIMENTACAO AS DATA_ULTIMA_MOVIMENTACAO,

  -- Dias desde a última movimentação
  CASE
    WHEN e.ESTOQUEDATAULTIMAMOVIMENTACAO IS NULL
      THEN NULL
    ELSE
      CURRENT_DATE - e.ESTOQUEDATAULTIMAMOVIMENTACAO
  END                         AS DIAS_ESTOQUE,

  -- Cobertura "simples" em relação ao mínimo (quantas vezes o mínimo)
  CASE
    WHEN e.PRODUTOMINIMO IS NULL OR e.PRODUTOMINIMO <= 0 THEN NULL
    ELSE
      e.PRODUTOSALDO / e.PRODUTOMINIMO
  END                         AS COBERTURA_MINIMO,

  -- CAF: placeholder (sem histórico de consumo diário aqui),
  -- pode ser ajustado depois se houver outra fonte.
  CAST(NULL AS NUMERIC(15,4)) AS CAF,

  -- Ação sugerida baseada em saldo / mínimo / máximo / dias em estoque
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
  END                         AS ACAO_SUGERIDA

FROM
  V_ESTOQUE e

  -- Empresa
  JOIN EMPRESA emp
    ON emp.COD_EMPRESA = e.ESTOQUECOD_EMPRESA
  JOIN PESSOA pesEmp
    ON pesEmp.COD_PESSOA = emp.COD_EMPRESA

  -- Fornecedor principal do item (se houver)
  LEFT JOIN V_FORNECEDORITEM vf
    ON vf.ITEMCOD_ITEM = e.ITEMCOD_ITEM

WHERE
  -- Filtro da empresa do estoque
  e.ESTOQUECOD_EMPRESA = CAST(? AS INTEGER)

ORDER BY
  pesEmp.NOME,
  NOME_FORNECEDOR,
  e.ITEMDESCRICAO;
