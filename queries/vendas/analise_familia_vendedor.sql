-- queries/vendas/analise_familia_vendedor.sql
-- Vendas por empresa, vendedor e família de produto
-- Filtro: intervalo de data (data de encerramento da transação)

SELECT
  -- Empresa “física”
  t.COD_EMPRESAESTOQUE        AS COD_EMPRESA,
  pesEmp.NOME                 AS EMPRESA,

  -- CAMPOS LÓGICOS DE EMPRESA (SUPER + SUPER SHOPPING)
  CASE
    WHEN emp.COD_EMPRESA IN (13, 18) THEN 13
    ELSE emp.COD_EMPRESA
  END                         AS empresa_cod_logico,

  CASE
    WHEN emp.COD_EMPRESA IN (13, 18) THEN 'DINIZ SUPER'
    ELSE pesEmp.NOME
  END                         AS empresa_nome_logico,

  -- Vendedor e família
  vend.COD_PESSOA             AS COD_VENDEDOR,
  vend.NOME                   AS VENDEDOR,
  pf.DESCRICAO                AS FAMILIA,

  -- Métricas
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

WHERE
  -- Ignora empresas lixo
  emp.COD_EMPRESA NOT IN (3, 5, 7, 8, 11, 12)

  -- Só natureza de operação de venda (ajuste conforme seu padrão)
  AND nat.TIPO = 1

  -- Período (data de encerramento da transação)
  AND t.DATAENCERRAMENTO BETWEEN cast(? as date) AND cast(? as date)

GROUP BY
  t.COD_EMPRESAESTOQUE,
  pesEmp.NOME,
  emp.COD_EMPRESA,
  vend.COD_PESSOA,
  vend.NOME,
  pf.DESCRICAO

ORDER BY
  empresa_cod_logico,
  VENDEDOR,
  FAMILIA;
