/* ============================================================
 * CRM - Aniversariantes em uma data específica
 * ------------------------------------------------------------
 * Retorna clientes cujo MONTH + DAY de datanascimento coincide
 * com a data alvo informada. Um cliente pode aparecer uma vez
 * mesmo tendo múltiplas OS (GROUP BY cod_cliente).
 * Dedup por CPF feito no service.
 *
 * Parâmetros posicionais:
 *   1) dataAlvo (DATE) — data para comparar mês/dia (ex: CURRENT_DATE)
 *   2) dataAlvo (DATE) — repetido (EXTRACT MONTH)
 *   3) empresa  (INTEGER | NULL) — NULL = todas
 *   4) empresa  (INTEGER | NULL) — repetido para IS NULL
 *
 * Colunas opcionais (datanascimento) injetadas em runtime pelo
 * service via placeholder /*__DATA_NASCIMENTO__*/.
 * ============================================================ */
SELECT
  pc.cod_pessoa                                                        AS cod_cliente,
  NULLIF(TRIM(pc.nome), '')                                            AS cliente,
  CASE
    WHEN pc.cpf IS NULL THEN NULL
    ELSE NULLIF(TRIM(CAST(pc.cpf AS VARCHAR(20))), '')
  END                                                                  AS cpf,
  CASE
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           TRIM(pc.telefonecelular),'-',''),' ',''),'(',''),')',''),'.','')
         SIMILAR TO '[0-9]{8,15}'
    THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           TRIM(pc.telefonecelular),'-',''),' ',''),'(',''),')',''),'.','')
    ELSE NULL
  END                                                                  AS telefone_celular,
  CASE
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           TRIM(pc.telefoneresidencial1),'-',''),' ',''),'(',''),')',''),'.','')
         SIMILAR TO '[0-9]{8,15}'
    THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           TRIM(pc.telefoneresidencial1),'-',''),' ',''),'(',''),')',''),'.','')
    ELSE NULL
  END                                                                  AS telefone_residencial,
  MAX(CAST(ocx.cod_empresaorigem AS VARCHAR(10)))                      AS cod_empresa
  /*__DATA_NASCIMENTO__*/
FROM pessoa pc
JOIN ordemservicocaixa ocx
  ON ocx.cod_cliente = pc.cod_pessoa
WHERE pc.datanascimento IS NOT NULL
  AND EXTRACT(MONTH FROM pc.datanascimento) = EXTRACT(MONTH FROM CAST(? AS DATE))
  AND EXTRACT(DAY   FROM pc.datanascimento) = EXTRACT(DAY   FROM CAST(? AS DATE))
  AND ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )
GROUP BY
  pc.cod_pessoa,
  pc.nome,
  pc.cpf,
  pc.telefonecelular,
  pc.telefoneresidencial1
  /*__GROUP_DATA_NASCIMENTO__*/
ORDER BY pc.nome
