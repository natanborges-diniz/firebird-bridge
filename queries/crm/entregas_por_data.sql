/* ============================================================
 * CRM - Clientes com OS entregue em uma faixa de datas
 * ------------------------------------------------------------
 * Retorna um registro por (cod_cliente, data_entrega), com a
 * data real em que a OS atingiu etapa 08 (entregue ao cliente).
 *
 * Parâmetros posicionais (todos obrigatórios via service):
 *   1) dataIni  (DATE) — início do intervalo de entrega
 *   2) dataFim  (DATE) — fim do intervalo de entrega
 *   3) empresa  (INTEGER | NULL) — NULL = todas as empresas
 *   4) empresa  (INTEGER | NULL) — repetido para regra IS NULL
 *
 * Dedup por (cod_cliente, data_entrega): quando o cliente tem
 * múltiplas OS entregues na mesma data, mantém o maior
 * numeroordemservico (OS mais recente do dia).
 * Dedup por CPF (múltiplos cod_cliente com mesmo CPF) é feito
 * no service, seguindo o mesmo padrão de base_clientes_entrega.
 *
 * Colunas opcionais (datanascimento) injetadas em runtime pelo
 * service via placeholder /*__DATA_NASCIMENTO__*/.
 * Colunas opcionais de endereço/telefone seguem o mesmo padrão.
 *
 * Filtro de garantia/reparo:
 *   Injetado via /*__FILTRO_OS_REGULAR__*/ (vide crmService).
 * ============================================================ */
WITH log_entregas AS (
  SELECT
    l.cod_ordemservicocaixa,
    CAST(l.datahoraentrada AS DATE) AS data_entrega
  FROM ordemservicocaixalog l
  WHERE l.cod_etapa = 8
    AND CAST(l.datahoraentrada AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
),

-- Pega a OS mais recente por (cod_cliente, data_entrega)
os_por_cliente_data AS (
  SELECT
    ocx.cod_cliente,
    e.data_entrega,
    MAX(ocx.numeroordemservico) AS numero_venda,
    MAX(ocx.cod_empresaorigem)  AS cod_empresa
  FROM log_entregas e
  JOIN ordemservicocaixa ocx
    ON ocx.cod_ordemservicocaixa = e.cod_ordemservicocaixa
  WHERE ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )
    /*__FILTRO_OS_REGULAR__*/
  GROUP BY ocx.cod_cliente, e.data_entrega
)

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
  od.data_entrega                                                      AS data_entrega,
  CAST(od.cod_empresa AS VARCHAR(10))                                  AS cod_empresa,
  CAST(od.numero_venda AS VARCHAR(30))                                 AS numero_venda
  /*__DATA_NASCIMENTO__*/
FROM os_por_cliente_data od
JOIN pessoa pc ON pc.cod_pessoa = od.cod_cliente
ORDER BY od.data_entrega DESC, pc.nome
