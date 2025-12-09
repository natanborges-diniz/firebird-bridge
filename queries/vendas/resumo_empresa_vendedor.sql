-- queries/vendas/resumo_empresa_vendedor.sql
-- Resumo de vendas por empresa e vendedor
-- Filtro: intervalo de data (DATAENCERRAMENTO da transação)

SELECT
  -- Empresa “física”
  t.COD_EMPRESAESTOQUE        AS COD_EMPRESA,
  pesEmp.NOME                 AS EMPRESA,

  -- Vendedor
  vend.COD_PESSOA             AS COD_VENDEDOR,
  vend.NOME                   AS VENDEDOR,

  -- Métricas de vendas
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

WHERE
  -- Ignora empresas lixo (regra global de negócio)
  emp.COD_EMPRESA NOT IN (3, 5, 7, 8, 11, 12)

  -- Apenas operações de venda (ajuste se sua regra for diferente)
  AND nat.TIPO = 1

  -- Período (competência = data de encerramento)
  AND t.DATAENCERRAMENTO BETWEEN cast(? as date) AND cast(? as date)

GROUP BY
  t.COD_EMPRESAESTOQUE,
  pesEmp.NOME,
  vend.COD_PESSOA,
  vend.NOME

ORDER BY
  pesEmp.NOME,
  vend.NOME;
