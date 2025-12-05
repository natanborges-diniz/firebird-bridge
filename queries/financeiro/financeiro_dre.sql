-- queries/financeiro/financeiro_dre.sql
-- DRE GERENCIAL SIMPLES
-- Competência = data de emissão da parcela

SELECT
  fl.cod_empresa                                  AS cod_empresa,
  pe_emp.nome                                     AS empresa_nome,

  EXTRACT(YEAR FROM fp.dataemissao)              AS ano_competencia,
  EXTRACT(MONTH FROM fp.dataemissao)             AS mes_competencia,

  -- Label de competência (ex: 2025-03)
  CAST(EXTRACT(YEAR FROM fp.dataemissao) AS VARCHAR(4))
    || '-' ||
    RIGHT('0' || CAST(EXTRACT(MONTH FROM fp.dataemissao) AS VARCHAR(2)), 2)
                                                AS competencia_label,

  -- RECEITAS (lancamento_pagar = 'F' → a receber)
  SUM(
    CASE
      WHEN fl.pagar = 'F' THEN fp.valor
      ELSE 0
    END
  )                                             AS total_receitas,

  -- DESPESAS (lancamento_pagar = 'T' → a pagar)
  SUM(
    CASE
      WHEN fl.pagar = 'T' THEN fp.valor
      ELSE 0
    END
  )                                             AS total_despesas,

  -- RESULTADO (receitas - despesas)
  SUM(
    CASE
      WHEN fl.pagar = 'F' THEN fp.valor
      ELSE 0
    END
  )
  -
  SUM(
    CASE
      WHEN fl.pagar = 'T' THEN fp.valor
      ELSE 0
    END
  )                                             AS resultado

FROM
  finlancamento fl
    JOIN finlancamentoparcela fp
      ON fp.cod_lancamento = fl.cod_lancamento
    JOIN pessoa pe_emp
      ON pe_emp.cod_pessoa = fl.cod_empresa

WHERE
  fl.cod_empresa = ?
  AND fp.dataemissao BETWEEN ? AND ?

GROUP BY
  fl.cod_empresa,
  pe_emp.nome,
  EXTRACT(YEAR FROM fp.dataemissao),
  EXTRACT(MONTH FROM fp.dataemissao),
  CAST(EXTRACT(YEAR FROM fp.dataemissao) AS VARCHAR(4))
    || '-' ||
    RIGHT('0' || CAST(EXTRACT(MONTH FROM fp.dataemissao) AS VARCHAR(2)), 2)

ORDER BY
  ano_competencia,
  mes_competencia;
