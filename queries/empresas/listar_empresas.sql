-- queries/empresas/listar_empresas.sql
-- Lista empresas (lojas) com codigo interno do ERP

SELECT
  EMPRESA.COD_EMPRESA,
  PESSOA.NOME AS EMPRESA
FROM
  EMPRESA
  JOIN PESSOA
    ON PESSOA.COD_PESSOA = EMPRESA.COD_EMPRESA
ORDER BY
  PESSOA.NOME;
