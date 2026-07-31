-- queries/catalogo/itens_cadastro.sql
-- Cadastro completo de produtos (ITEM + PRODUTO) — SEM junção com estoque.
-- Finalidade: sincronização de catálogo externo (Atlas). O código de barras
-- interno (PRODUTO.CODIGOBARRA, 0% nulo) é a chave estável por SKU.
-- Contrato: uma linha por cod_sku (vínculo de fornecedor deduplicado pelo
-- flag PRINCIPAL; fallback qualquer vínculo).
-- Classificação de tipo: PRODUTO.COD_PRODUTOTIPO primeiro (7 = lentes de
-- grau, 13 = armações — mapeamento confirmado em
-- queries/debug/produto_tipo_samples.sql), heurística LG/GC/LC de descrição
-- como complemento (mesma regra de estoque_completo.sql).
-- Marcadores substituídos em runtime pelo catalogoService (padrão de poda
-- por schema/parametrização — ver CLAUDE.md): WHERE (filtro tipo/ativos),
-- ATIVO_SELECT (coluna de ativação) e ROWS (paginação a TO b).
-- ATENÇÃO: não escrever os marcadores literais em comentários — o replace
-- em runtime atingiria o comentário, não o SQL.
-- Cadastro tem ~1M de linhas: consumir SEMPRE paginado (limit/offset).
-- Parâmetros posicionais: nenhum (filtros via marcadores validados em
-- whitelist no service).

SELECT
  produto.cod_produto                              AS cod_sku,
  produto.codigobarra                              AS codigo_barras,
  CASE
    WHEN TRIM(produto.gtin) SIMILAR TO '[0-9]{8,14}' THEN TRIM(produto.gtin)
    ELSE NULL
  END                                              AS ean,
  item.descricao                                   AS descricao,
  produto.cod_produtotipo                          AS cod_produtotipo,
  TRIM(CASE
    WHEN ' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% GC %' THEN 'LENTES_CONTATO'
    WHEN ' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% LC %' THEN 'LENTES_CONTATO'
    WHEN produto.cod_produtotipo = 7                             THEN 'LENTES_GRAU'
    WHEN produto.cod_produtotipo = 13                            THEN 'ARMACOES'
    WHEN ' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% LG %' THEN 'LENTES_GRAU'
    WHEN UPPER(TRIM(item.descricao)) STARTING WITH 'OC'
      OR UPPER(TRIM(item.descricao)) STARTING WITH 'AR'          THEN 'ARMACOES'
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
  -- Subqueries CORRELACIONADAS de propósito: executam só para as linhas que
  -- passam no WHERE/paginação (lookup indexado por cod_item). A versão com
  -- LEFT JOIN + GROUP BY materializava as tabelas inteiras (~1M) mesmo em
  -- delta de poucas linhas.
  COALESCE((
    SELECT MIN(pessoafornecedor.nome)
    FROM fornecedor_item
    JOIN pessoa pessoafornecedor
      ON pessoafornecedor.cod_pessoa = fornecedor_item.cod_fornecedor
    WHERE fornecedor_item.cod_item = item.cod_item
      AND fornecedor_item.principal = 'T'
  ), 'SEM FORNECEDOR')                             AS fornecedor_nome,
  COALESCE((
    SELECT MIN(itemclassificacao.descricao)
    FROM itemclassificacao
    JOIN item_itemclassificacao
      ON item_itemclassificacao.cod_itemclassificacao = itemclassificacao.cod_itemclassificacao
    WHERE item_itemclassificacao.cod_item = item.cod_item
      AND itemclassificacao.cod_dwitemclassificacao = 42
  ), 'SEM MARCA')                                  AS grife,
  COALESCE(produto.precocusto, 0)                  AS preco_custo,
  COALESCE(item.precovenda, 0)                     AS preco_venda,
  produto.dataultimacompra                         AS data_ultima_compra
  /*__ATIVO_SELECT__*/
FROM
  produto
  JOIN item
    ON item.cod_item = produto.cod_produto
/*__WHERE__*/
ORDER BY
  produto.cod_produto ASC
/*__ROWS__*/
;
