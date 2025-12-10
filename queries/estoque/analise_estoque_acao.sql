-- queries/estoque/analise_estoque_acao.sql
-- Análise de estoque com ação sugerida por item / fornecedor.
-- Filtro: empresa (cod_empresaestoque).

SELECT
  -- Empresa física
  e.COD_EMPRESAESTOQUE         AS COD_EMPRESA,
  pesEmp.NOME                  AS EMPRESA,

  -- Fornecedor (via relacionamento fornecedor_item → pessoa)
  forn.COD_PESSOA              AS COD_PESSOA,
  forn.NOME                    AS NOME_FORNECEDOR,

  -- Item / produto
  it.COD_ITEM                  AS COD_ITEM,
  it.DESCRICAO                 AS DESCRICAO_ITEM,

  -- Saldo e indicadores de estoque
  COALESCE(e.SALDO, 0)         AS SALDO_ESTOQUE,
  COALESCE(e.CAF, 0)           AS CAF,
  e.DATAULTIMAENTRADA          AS DATA_ULTIMA_ENTRADA,

  -- Dias desde a última entrada
  CASE
    WHEN e.DATAULTIMAENTRADA IS NULL
      THEN NULL
    ELSE
      CURRENT_DATE - e.DATAULTIMAENTRADA
  END                          AS DIAS_ESTOQUE,

  -- Ação sugerida simples, baseada em saldo + dias desde última entrada
  CASE
    WHEN COALESCE(e.SALDO, 0) <= 0 THEN 'SEM ESTOQUE'
    WHEN e.DATAULTIMAENTRADA IS NULL THEN 'ANALISE PARA RECOMPRA'
    WHEN (CURRENT_DATE - e.DATAULTIMAENTRADA) <= 60 THEN 'OK'
    WHEN (CURRENT_DATE - e.DATAULTIMAENTRADA) BETWEEN 61 AND 120 THEN 'ANALISE PARA RECOMPRA'
    ELSE 'LIQUIDA 30%'
  END                          AS ACAO_SUGERIDA

FROM
  ESTOQUE e
  JOIN EMPRESA emp
    ON emp.COD_EMPRESA = e.COD_EMPRESAESTOQUE
  JOIN PESSOA pesEmp
    ON pesEmp.COD_PESSOA = emp.COD_EMPRESA

  JOIN ITEM it
    ON it.COD_ITEM = e.COD_ITEM

  LEFT JOIN FORNECEDOR_ITEM fi
    ON fi.COD_ITEM = it.COD_ITEM

  LEFT JOIN PESSOA forn
    ON forn.COD_PESSOA = fi.COD_PESSOA

WHERE
  -- Filtro da empresa do estoque
  e.COD_EMPRESAESTOQUE = CAST(? AS INTEGER)

ORDER BY
  pesEmp.NOME,
  NOME_FORNECEDOR,
  DESCRICAO_ITEM;
