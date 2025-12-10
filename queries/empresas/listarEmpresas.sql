-- queries/empresas/listarEmpresas.sql
-- Lista de empresas unificando SUPER (13/18)

SELECT
    CASE 
        WHEN e.COD_EMPRESA IN (13, 18) THEN 13
        ELSE e.COD_EMPRESA
    END AS cod_empresa,

    CASE 
        WHEN e.COD_EMPRESA IN (13, 18) THEN 'DINIZ SUPER'
        ELSE e.NOME_FANTASIA
    END AS empresa_nome

FROM EMPRESA e
WHERE
    e.ATIVA = 'S'
    AND e.COD_EMPRESA NOT IN (3, 5, 7, 8, 11, 12)
GROUP BY
    1, 2
ORDER BY
    empresa_nome;
