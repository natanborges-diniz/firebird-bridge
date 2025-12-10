-- queries/estoque/analise_estoque_acao.sql
-- Análise de estoque com ação sugerida por item / fornecedor.
-- Filtro: empresa (cod_empresa do estoque).

SELECT
  -- Empresa física
  e.COD_EMPRESA               AS COD_EMPRESA,
  pesEmp.NOME                 AS EMPRESA,

  -- Fornecedor (via fornecedor_item → pessoa)
  forn.COD_PESSOA             AS COD_PESSOA,
  forn.NOME                   AS NOME_FORNECEDOR,

  -- Produto (usado como "item" lógico)
  p.COD_PRODUTO               AS COD_ITEM,
  p.DESCRICAO                 AS DESCRICAO_ITEM,

  -- Saldo e indicadores de estoque
  COALESCE(e.SALDO, 0)        AS SALDO_ESTOQUE,
  COALESCE(e.CAF, 0)          AS CAF,
  e.DATAULTIMAENTRADA         AS DATA_ULTIMA_ENTRADA,

  -- Dias desde a última entrada
  CASE
    WHEN e.DATAULTIMAENTRADA IS NULL
      THEN NULL
    ELSE
      CURRENT_DATE - e.DATAULTIMAENTRADA
  END                         AS DIAS_ESTOQUE,

  -- Ação sugerida simples, baseada em saldo + dias desde última entrada
  CASE
    WHEN COALESCE(e.SALDO, 0) <= 0 THEN 'SEM ESTOQUE'
    WHEN e.DATAULTIMAENTRADA IS NULL THEN 'ANALISE PARA RECOMPRA'
    WHEN (CURRENT_DATE - e.DATAULTIMAENTRADA) <= 60 THEN 'OK'
    WHEN (CURRENT_DATE - e.DATAULTIMAENTRADA) BETWEEN 61 AND 120 THEN 'ANALISE PARA RECOMPRA'
    ELSE 'LIQUIDA 30%'
  END                         AS ACAO_SUGERIDA

FROM
  ESTOQUE e
  JOIN EMPRESA emp
    ON emp.COD_EMPRESA = e.COD_EMPRESA
  JOIN PESSOA pesEmp
    ON pesEmp.COD_PESSOA = emp.COD_EMPRESA

  -- Produto ligado diretamente ao estoque
  JOIN PRODUTO p
    ON p.COD_PRODUTO = e.COD_PRODUTO

  -- Fornecedor principal do produto
  LEFT JOIN FORNECEDOR_ITEM fi
    ON fi.COD_PRODUTO = p.COD_PRODUTO

  LEFT JOIN PESSOA forn
    ON forn.COD_PESSOA = fi.COD_PESSOA

WHERE
  -- Filtro da empresa do estoque
  e.COD_EMPRESA = CAST(? AS INTEGER)

ORDER BY
  pesEmp.NOME,
  NOME_FORNECEDOR,
  DESCRICAO_ITEM;
