/* ============================================================
 * CRM - Base de clientes para entrega
 * ------------------------------------------------------------
 * Lista os clientes que possuem ordem de servico em uma empresa
 * (cod_empresaorigem), com dados de contato/endereco para a
 * logistica de entrega.
 *
 * Filtro:
 *   ?empresa=<cod_empresaorigem>  (NULL/ALL = todas as empresas)
 *
 * Limpeza aplicada (qualidade de cadastro):
 *   - TRIM em todos os campos texto (remove padding de CHAR);
 *     campos que ficam vazios viram NULL (NULLIF).
 *   - Telefones: removidos separadores ( - espaco ( ) . ) e
 *     validados como 8 a 15 digitos; lixo (texto, muito curto)
 *     vira NULL.
 *   - E-mail: so mantido se tiver formato minimo (x@y.z); valores
 *     como "SEM E-MAIL", "NAO", "0001" viram NULL.
 *
 * Colunas:
 *   - Bloco fixo: colunas verificadas como existentes na PESSOA.
 *   - O crmService injeta no marcador as colunas opcionais de
 *     endereco/contato que existirem no schema; inexistentes sao
 *     descartadas.
 *
 * Regra de negocio:
 *   - OS de garantia/reparo NAO sao venda e sao ignoradas (linha
 *     em vendagarantia_item). O crmService injeta o filtro no
 *     marcador, se a tabela existir.
 *
 * Deduplicacao por CPF: feita no crmService (mantem o registro de
 * maior cod_cliente por CPF; clientes sem CPF sao preservados).
 * ============================================================ */
SELECT DISTINCT
    pc.cod_pessoa                          AS cod_cliente,
    NULLIF(TRIM(pc.nome), '')              AS cliente,
    NULLIF(TRIM(CAST(pc.cpf AS VARCHAR(20))), '') AS cpf,
    CASE WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(pc.telefonecelular),'-',''),' ',''),'(',''),')',''),'.','') SIMILAR TO '[0-9]{8,15}'
         THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(pc.telefonecelular),'-',''),' ',''),'(',''),')',''),'.','')
         ELSE NULL END                     AS telefone_celular,
    CASE WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(pc.telefoneresidencial1),'-',''),' ',''),'(',''),')',''),'.','') SIMILAR TO '[0-9]{8,15}'
         THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(pc.telefoneresidencial1),'-',''),' ',''),'(',''),')',''),'.','')
         ELSE NULL END                     AS telefone_residencial,
    CASE WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(pc.telefonecomercial1),'-',''),' ',''),'(',''),')',''),'.','') SIMILAR TO '[0-9]{8,15}'
         THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(pc.telefonecomercial1),'-',''),' ',''),'(',''),')',''),'.','')
         ELSE NULL END                     AS telefone_comercial
    /*__COLUNAS_OPCIONAIS__*/
FROM ordemservicocaixa ocx
JOIN pessoa pc
  ON pc.cod_pessoa = ocx.cod_cliente
WHERE ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )
  /*__FILTRO_OS_REGULAR__*/
ORDER BY 2
