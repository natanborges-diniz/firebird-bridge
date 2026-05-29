/* ============================================================
 * CRM - Base de clientes para entrega
 * ------------------------------------------------------------
 * Lista, sem duplicatas, os clientes que possuem ordem de
 * serviço em uma empresa (cod_empresaorigem), com os dados de
 * contato/endereco necessarios para logistica de entrega.
 *
 * Filtro:
 *   ?empresa=<cod_empresaorigem>  (NULL/ALL = todas as empresas)
 *
 * Colunas:
 *   - Bloco fixo: colunas verificadas como existentes na tabela
 *     PESSOA (as mesmas usadas por queries/os/monitor.sql, que
 *     roda em producao).
 *   - Em seguida o crmService injeta, no marcador abaixo, as
 *     colunas opcionais de endereco/contato que de fato existirem
 *     no schema (checadas via catalogo de sistema do Firebird).
 *     Colunas inexistentes sao automaticamente descartadas.
 *
 * Regra de negocio:
 *   - OS de garantia/reparo NAO sao venda e devem ser ignoradas.
 *     Elas sao identificadas por possuirem linha em
 *     vendagarantia_item (cod_ordemservicocaixa). O crmService
 *     injeta o filtro de exclusao no marcador abaixo (apenas se a
 *     tabela existir no schema). Assim a base considera somente
 *     OS regulares de venda.
 * ============================================================ */
SELECT DISTINCT
    pc.cod_pessoa            AS cod_cliente,
    pc.nome                  AS cliente,
    pc.cpf                   AS cpf,
    pc.telefonecelular       AS telefone_celular,
    pc.telefoneresidencial1  AS telefone_residencial,
    pc.telefonecomercial1    AS telefone_comercial
    /*__COLUNAS_OPCIONAIS__*/
FROM ordemservicocaixa ocx
JOIN pessoa pc
  ON pc.cod_pessoa = ocx.cod_cliente
WHERE ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )
  /*__FILTRO_OS_REGULAR__*/
ORDER BY pc.nome
