-- queries/vendas/analise_familia_vendedor.sql
-- Vendas por empresa, vendedor e família de produto
-- Filtros: intervalo de data e (opcional) empresa

SELECT
  t.COD_EMPRESAESTOQUE        AS COD_EMPRESA,
  pesEmp.NOME                 AS EMPRESA,

  /* CAMPOS LÓGICOS DE EMPRESA (SUPER + SUPER SHOPPING) */
  case
    when fl.cod_empresa in (13, 18) then 13
    else fl.cod_empresa
  end                                         as empresa_cod_logico,

  case
    when fl.cod_empresa in (13, 18) then 'DINIZ SUPER'
    else pe_emp.nome
  end                                         as empresa_nome_logico,
  
  vend.COD_PESSOA             AS COD_VENDEDOR,
  vend.NOME                   AS VENDEDOR,
  pf.DESCRICAO                AS FAMILIA,
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
  /* Ignora empresas lixo */
  fl.cod_empresa not in (3, 5, 7, 8, 11, 12)
  and (
    /* Empresas normais: filtra direto pelo código informado */
    fl.cod_empresa = cast(? as integer)
    or (
      /* Se a empresa pedida for 13 ou 18, traz tanto 13 quanto 18 */
      cast(? as integer) in (13, 18)
      and fl.cod_empresa in (13, 18)
    )
  )
  nat.TIPO = 1
  AND transacao.dataencerramento >= cast(? as date)
  AND transacao.dataencerramento <= cast(? as date))
  AND (? IS NULL OR t.COD_EMPRESAESTOQUE = ?)
GROUP BY
  t.COD_EMPRESAESTOQUE,
  pesEmp.NOME,
  vend.COD_PESSOA,
  vend.NOME,
  pf.DESCRICAO
ORDER BY
  pesEmp.NOME,
  vend.NOME,
  pf.DESCRICAO;
