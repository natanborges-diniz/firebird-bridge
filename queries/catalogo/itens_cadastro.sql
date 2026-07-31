-- queries/catalogo/itens_cadastro.sql
-- Cadastro completo de produtos (ITEM + PRODUTO) — SEM junção com estoque.
-- Finalidade: sincronização de catálogo externo (Atlas). O código de barras
-- interno (PRODUTO.CODIGOBARRA, 0% nulo) é a chave estável por SKU.
-- Contrato: uma linha por cod_sku (vínculo de fornecedor deduplicado por
-- ROW_NUMBER, mesmo padrão de estoque_completo.sql).
-- Classificação de tipo: mesma heurística de estoque_completo.sql
-- (LG/GC/LC como palavra isolada; sem o ramo 'PRODUTOS' por não haver
-- junção com transações aqui).
-- O marcador ATIVO_SELECT (comentário de bloco no SELECT) é substituído em
-- runtime pelo catalogoService quando a coluna de ativação existir no schema
-- (padrão hasColumn — ver CLAUDE.md). Idem ROWS para o ?limit=.
-- ATENÇÃO: não escrever os marcadores literais em comentários — o replace
-- em runtime atingiria o comentário, não o SELECT.
-- Parâmetros: nenhum (cadastro é global, não varia por empresa).

WITH
  tbmarcamodeloar AS (
    SELECT
      item_itemclassificacao.cod_item,
      itemclassificacao.descricao
    FROM
      itemclassificacao
      JOIN item_itemclassificacao
        ON item_itemclassificacao.cod_itemclassificacao = itemclassificacao.cod_itemclassificacao
    WHERE
      itemclassificacao.cod_dwitemclassificacao = 42
  ),

  tbFornecedorVinculo AS (
    SELECT
      fornecedor_item.cod_item,
      fornecedor_item.cod_fornecedor,
      pessoafornecedor.nome AS fornecedor_nome,
      ROW_NUMBER() OVER (
        PARTITION BY fornecedor_item.cod_item
        ORDER BY pessoafornecedor.nome ASC
      ) AS rn
    FROM
      fornecedor_item
      JOIN pessoa pessoafornecedor
        ON pessoafornecedor.cod_pessoa = fornecedor_item.cod_fornecedor
  )

SELECT q.* FROM (
SELECT
  produto.cod_produto                              AS cod_sku,
  produto.codigobarra                              AS codigo_barras,
  CASE
    WHEN TRIM(produto.gtin) SIMILAR TO '[0-9]{8,14}' THEN TRIM(produto.gtin)
    ELSE NULL
  END                                              AS ean,
  item.descricao                                   AS descricao,
  TRIM(CASE
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'OC'
      OR UPPER(TRIM(item.descricao)) STARTING WITH 'AR'          THEN 'ARMACOES'
    WHEN ' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% LG %' THEN 'LENTES_GRAU'
    WHEN ' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% GC %' THEN 'LENTES_CONTATO'
    WHEN ' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% LC %' THEN 'LENTES_CONTATO'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'AC'          THEN 'ACESSORIOS'
    ELSE 'OUTROS'
  END)                                             AS tipo,
  TRIM(CASE
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'OC'          THEN 'AR_SOLAR'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'AR'          THEN 'AR_RX'
    WHEN ' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% LG %' THEN 'LENTES_GRAU'
    WHEN ' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% GC %' THEN 'LENTES_CONTATO'
    WHEN ' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% LC %' THEN 'LENTES_CONTATO'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'AC'          THEN 'ACESSORIOS'
    ELSE 'OUTROS'
  END)                                             AS subcategoria,
  COALESCE(tbFornecedorVinculo.fornecedor_nome, 'SEM FORNECEDOR')
                                                   AS fornecedor_nome,
  COALESCE(tbmarcamodeloar.descricao, 'SEM MARCA') AS grife,
  COALESCE(produto.precocusto, 0)                  AS preco_custo,
  COALESCE(item.precovenda, 0)                     AS preco_venda,
  produto.dataultimacompra                         AS data_ultima_compra
  /*__ATIVO_SELECT__*/
FROM
  produto
  JOIN item
    ON item.cod_item = produto.cod_produto
  LEFT JOIN tbFornecedorVinculo
    ON tbFornecedorVinculo.cod_item = item.cod_item
   AND tbFornecedorVinculo.rn = 1
  LEFT JOIN tbmarcamodeloar
    ON tbmarcamodeloar.cod_item = item.cod_item
) q
/*__WHERE_TIPO__*/
ORDER BY
  q.cod_sku ASC
/*__ROWS__*/
;
