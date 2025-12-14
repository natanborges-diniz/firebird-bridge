-- queries/vendas/resumo_empresa_vendedor.sql
-- Resumo de vendas por empresa e vendedor + devoluções
-- Parâmetros (4):
--   1) empresa (integer)
--   2) empresa (integer) repetido (regra 13/18)
--   3) dataInicio (date)
--   4) dataFim (date)

WITH
P AS (
  SELECT
    CAST(? AS INTEGER) AS P_EMPRESA,
    CAST(? AS INTEGER) AS P_EMPRESA2,
    CAST(? AS DATE)    AS P_DATA_INI,
    CAST(? AS DATE)    AS P_DATA_FIM
  FROM RDB$DATABASE
),

TBEMPRESA AS (
  SELECT
    EMPRESA.COD_EMPRESA,
    PESSOA.NOME AS EMPRESA_NOME
  FROM EMPRESA
  JOIN PESSOA ON PESSOA.COD_PESSOA = EMPRESA.COD_EMPRESA
)

SELECT
  x.COD_EMPRESA,
  x.EMPRESA,

  /* CAMPOS LÓGICOS (SUPER + SUPER SHOPPING) */
  CASE
    WHEN x.COD_EMPRESA IN (13, 18) THEN 13
    ELSE x.COD_EMPRESA
  END AS EMPRESA_COD_LOGICO,

  CASE
    WHEN x.COD_EMPRESA IN (13, 18) THEN 'DINIZ SUPER'
    ELSE x.EMPRESA
  END AS EMPRESA_NOME_LOGICO,

  x.COD_VENDEDOR,
  x.VENDEDOR,

  SUM(x.QTD_TRANSACAO)    AS QTD_TRANSACAO,
  SUM(x.QTD_PRODUTOS)     AS QTD_PRODUTOS,
  SUM(x.TOTAL_VENDIDO)    AS TOTAL_VENDIDO,

  SUM(x.QTD_DEVOLUCAO)    AS QTD_DEVOLUCAO,
  SUM(x.TOTAL_DEVOLUCAO)  AS TOTAL_DEVOLUCAO

FROM (
  /* =========================
     BLOCO 1: VENDAS (TIPO=1)
     ========================= */
  SELECT
    t.COD_EMPRESAESTOQUE            AS COD_EMPRESA,
    emp.EMPRESA_NOME                AS EMPRESA,

    vend.COD_PESSOA                 AS COD_VENDEDOR,
    vend.NOME                       AS VENDEDOR,

    COUNT(DISTINCT t.COD_TRANSACAO) AS QTD_TRANSACAO,
    SUM(ti.QUANTIDADE)              AS QTD_PRODUTOS,
    SUM(ti.TOTAL - ti.VALORDESCONTO - ti.TOTALIPI) AS TOTAL_VENDIDO,

    0 AS QTD_DEVOLUCAO,
    0 AS TOTAL_DEVOLUCAO

  FROM
    P
    JOIN TRANSACAO t
      ON 1=1
    JOIN TRANSACAO_ITEM ti
      ON t.COD_TRANSACAO = ti.COD_TRANSACAO
     AND t.COD_EMPRESA   = ti.COD_EMPRESA
    JOIN NATUREZAOPERACAO nat
      ON ti.COD_NATUREZAOPERACAO = nat.COD_NATUREZAOPERACAO
    JOIN SAIDA s
      ON s.COD_SAIDA    = t.COD_TRANSACAO
     AND s.COD_EMPRESA  = t.COD_EMPRESA
    JOIN PESSOA vend
      ON vend.COD_PESSOA = s.COD_VENDEDOR
    JOIN TBEMPRESA emp
      ON emp.COD_EMPRESA = t.COD_EMPRESAESTOQUE

  WHERE
    /* Regra global: ignora empresas lixo */
    emp.COD_EMPRESA NOT IN (3, 5, 7, 8, 11, 12)

    /* Filtra empresa (inclui regra 13/18) */
    AND (
      t.COD_EMPRESAESTOQUE = P.P_EMPRESA
      OR (
        P.P_EMPRESA2 IN (13, 18)
        AND t.COD_EMPRESAESTOQUE IN (13, 18)
      )
    )

    /* Vendas */
    AND nat.TIPO = 1

    /* Período */
    AND t.DATAENCERRAMENTO BETWEEN P.P_DATA_INI AND P.P_DATA_FIM

  GROUP BY
    t.COD_EMPRESAESTOQUE,
    emp.EMPRESA_NOME,
    vend.COD_PESSOA,
    vend.NOME

  UNION ALL

  /* ==========================================
     BLOCO 2: DEVOLUÇÕES (ENTRADANOTAFISCALDEVOLUCAO)
     ========================================== */
  SELECT
    td.COD_EMPRESAESTOQUE           AS COD_EMPRESA,
    emp.EMPRESA_NOME                AS EMPRESA,

    vendDev.COD_PESSOA              AS COD_VENDEDOR,
    vendDev.NOME                    AS VENDEDOR,

    0 AS QTD_TRANSACAO,
    0 AS QTD_PRODUTOS,
    0 AS TOTAL_VENDIDO,

    COUNT(DISTINCT td.COD_TRANSACAO) AS QTD_DEVOLUCAO,
    SUM(tid.TOTAL)                   AS TOTAL_DEVOLUCAO

  FROM
    P
    JOIN TRANSACAO td
      ON 1=1
    JOIN ENTRADANOTAFISCALDEVOLUCAO dev
      ON td.COD_TRANSACAO = dev.COD_ENTRADANOTAFISCALDEVOLUCAO
     AND td.COD_EMPRESA   = dev.COD_EMPRESA
    JOIN TRANSACAO_ITEM tid
      ON tid.COD_TRANSACAO = td.COD_TRANSACAO
     AND tid.COD_EMPRESA   = td.COD_EMPRESA
    JOIN TBEMPRESA emp
      ON emp.COD_EMPRESA = td.COD_EMPRESAESTOQUE
    JOIN PESSOA vendDev
      ON vendDev.COD_PESSOA = dev.COD_VENDEDOR

  WHERE
    /* Regra global: ignora empresas lixo */
    emp.COD_EMPRESA NOT IN (3, 5, 7, 8, 11, 12)

    /* Filtra empresa (inclui regra 13/18) */
    AND (
      td.COD_EMPRESAESTOQUE = P.P_EMPRESA
      OR (
        P.P_EMPRESA2 IN (13, 18)
        AND td.COD_EMPRESAESTOQUE IN (13, 18)
      )
    )

    /* Período */
    AND td.DATAENCERRAMENTO BETWEEN P.P_DATA_INI AND P.P_DATA_FIM

  GROUP BY
    td.COD_EMPRESAESTOQUE,
    emp.EMPRESA_NOME,
    vendDev.COD_PESSOA,
    vendDev.NOME

) x

GROUP BY
  x.COD_EMPRESA,
  x.EMPRESA,
  x.COD_VENDEDOR,
  x.VENDEDOR

ORDER BY
  EMPRESA_COD_LOGICO,
  VENDEDOR;
