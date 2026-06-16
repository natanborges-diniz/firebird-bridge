-- queries/vendas/analise_familia_vendedor.sql
-- Vendas por empresa, vendedor e família
-- Parâmetros:
--   1) empresa (int)
--   2) empresa (int) (repetido p/ regra 13/18)
--   3) dataInicio (date)
--   4) dataFim (date)

SELECT
  t.COD_EMPRESAESTOQUE        AS COD_EMPRESA,
  pesEmp.NOME                 AS EMPRESA,

  CASE
    WHEN emp.COD_EMPRESA IN (13, 18) THEN 13
    ELSE emp.COD_EMPRESA
  END                         AS empresa_cod_logico,

  CASE
    WHEN emp.COD_EMPRESA IN (13, 18) THEN 'DINIZ SUPER'
    ELSE pesEmp.NOME
  END                         AS empresa_nome_logico,

  vend.COD_PESSOA             AS COD_VENDEDOR,
  vend.NOME                   AS VENDEDOR,
  pf.DESCRICAO                AS FAMILIA,

  fi.COD_FORNECEDOR           AS COD_FORNECEDOR,
  pesForn.NOME                AS FORNECEDOR,

  COUNT(DISTINCT t.COD_TRANSACAO) AS QTD_TRANSACAO,
  SUM(ti.QUANTIDADE)              AS QTD_PRODUTOS,
  SUM(ti.TOTAL - ti.VALORDESCONTO - ti.TOTALIPI) AS TOTAL_VENDIDO

FROM
  TRANSACAO t
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

  JOIN EMPRESA emp
    ON emp.COD_EMPRESA = t.COD_EMPRESAESTOQUE

  JOIN PESSOA pesEmp
    ON pesEmp.COD_PESSOA = emp.COD_EMPRESA

  JOIN ITEM it
    ON it.COD_ITEM = ti.COD_ITEM

  JOIN PRODUTO p
    ON p.COD_PRODUTO = it.COD_ITEM

  JOIN PRODUTOFAMILIA pf
    ON pf.COD_PRODUTOFAMILIA = COALESCE(ti.COD_PRODUTOFAMILIA, p.COD_PRODUTOFAMILIA)

  LEFT JOIN FORNECEDOR_ITEM fi
    ON fi.COD_ITEM = it.COD_ITEM

  LEFT JOIN PESSOA pesForn
    ON pesForn.COD_PESSOA = fi.COD_FORNECEDOR

WHERE
  emp.COD_EMPRESA NOT IN (3, 5, 7, 8, 11, 12)
  AND nat.TIPO = 1

  AND (
    emp.COD_EMPRESA = CAST(? AS INTEGER)
    OR (
      CAST(? AS INTEGER) IN (13, 18)
      AND emp.COD_EMPRESA IN (13, 18)
    )
  )

  AND t.DATAENCERRAMENTO BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)

GROUP BY
  t.COD_EMPRESAESTOQUE,
  pesEmp.NOME,
  emp.COD_EMPRESA,
  vend.COD_PESSOA,
  vend.NOME,
  pf.DESCRICAO,
  fi.COD_FORNECEDOR,
  pesForn.NOME

ORDER BY
  empresa_cod_logico,
  VENDEDOR,
  FAMILIA;
