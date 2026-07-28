-- queries/estoque/investigacao_categoria_outros.sql
-- [EXPERIMENTAL/DEBUG] Investigação B.4 — SKUs classificados como "Outros"
-- Um SKU cai em "Outros" quando item.descricao não começa com:
--   LG, GC, LC  → LENTES
--   OC, AR      → ARMACOES
--   AC          → ACESSORIOS  (subcategoria apenas; tipo ainda seria OUTROS)
-- Parâmetros:
--   1) cod_empresa (INTEGER)

WITH
  tbestoque AS (
    SELECT
      estoque.cod_empresa,
      estoque.cod_produto,
      SUM(estoque.saldo) AS saldo
    FROM
      estoque
    WHERE
      estoque.cod_empresa = CAST(? AS INTEGER)
      AND estoque.cod_estoquelocal = 1
      AND estoque.saldo > 0
    GROUP BY
      1, 2
  ),

  tbmarcamodeloar AS (
    SELECT
      item_itemclassificacao.cod_item,
      itemclassificacao.descricao
    FROM
      itemclassificacao
      JOIN item_itemclassificacao
        ON item_itemclassificacao.cod_itemclassificacao = itemclassificacao.cod_itemclassificacao
      JOIN tbestoque
        ON tbestoque.cod_produto = item_itemclassificacao.cod_item
    WHERE
      itemclassificacao.cod_dwitemclassificacao = 42
  ),

  tbEmpresa AS (
    SELECT
      empresa.cod_empresa,
      pessoa.nome AS nome_empresa
    FROM
      empresa
      JOIN pessoa ON pessoa.cod_pessoa = empresa.cod_empresa
    WHERE
      empresa.cod_empresa = CAST(? AS INTEGER)
  )

SELECT
  produto.cod_produto                              AS codigo,
  item.descricao                                   AS descricao,
  COALESCE(tbmarcamodeloar.descricao, 'SEM MARCA') AS marca,
  COALESCE(tbEmpresa.nome_empresa, '')             AS empresa,
  tbestoque.saldo                                  AS estoque_atual,
  CASE
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'LG' THEN 'LENTES'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'GC' THEN 'LENTES'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'LC' THEN 'LENTES'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'OC' THEN 'ARMACOES'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'AR' THEN 'ARMACOES'
    ELSE 'OUTROS'
  END                                              AS tipo,
  CASE
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'OC' THEN 'AR_SOLAR'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'AR' THEN 'AR_RX'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'LG' THEN 'LENTES_GRAU'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'GC' THEN 'LENTES_CONTATO'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'LC' THEN 'LENTES_CONTATO'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'AC' THEN 'ACESSORIOS'
    ELSE 'OUTROS'
  END                                              AS subcategoria,
  -- Prefixo real para diagnóstico
  UPPER(TRIM(SUBSTRING(item.descricao FROM 1 FOR 2))) AS prefixo_descricao,
  'prefixo_nao_mapeado'                            AS criterio_classificacao
FROM
  tbestoque
  JOIN produto
    ON produto.cod_produto = tbestoque.cod_produto
  JOIN item
    ON item.cod_item = produto.cod_produto
  LEFT JOIN tbmarcamodeloar
    ON tbmarcamodeloar.cod_item = item.cod_item
  LEFT JOIN tbEmpresa
    ON tbEmpresa.cod_empresa = tbestoque.cod_empresa
WHERE
  -- Apenas os que caem em OUTROS (não começam com prefixos mapeados)
  NOT (UPPER(TRIM(item.descricao)) STARTING WITH 'LG')
  AND NOT (UPPER(TRIM(item.descricao)) STARTING WITH 'GC')
  AND NOT (UPPER(TRIM(item.descricao)) STARTING WITH 'LC')
  AND NOT (UPPER(TRIM(item.descricao)) STARTING WITH 'OC')
  AND NOT (UPPER(TRIM(item.descricao)) STARTING WITH 'AR')
ORDER BY
  tbestoque.saldo DESC,
  produto.cod_produto ASC
;
