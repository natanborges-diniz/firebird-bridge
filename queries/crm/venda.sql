/* ============================================================
 * CRM — OS de uma venda por VENDA.NUMEROVENDA (ou fallback OS)
 * ------------------------------------------------------------
 * Retorna uma linha por OS da venda, com dados de entrega,
 * produto, CPF e flag de "passou pelo pronto".
 *
 * Parâmetros posicionais (5× cod_venda = VENDA.COD_VENDA):
 *   1) cod_venda — JOIN do CTE pronto
 *   2) cod_venda — JOIN do CTE entrega_log
 *   3) cod_venda — WHERE do CTE produtos (por OS)
 *   4) cod_venda — WHERE do CTE produtos_tx (fallback transação)
 *   5) cod_venda — WHERE principal
 *
 * Placeholders substituídos em runtime pelo crmService:
 *   /*__DATA_NASCIMENTO__*/   → pc.datanascimento se existir
 *   /*__FILTRO_OS_REGULAR__*/ → NOT EXISTS (vendagarantia_item)
 * ============================================================ */
WITH
-- Primeira passagem pelo pronto (etapa 5 = OS na loja; 6 = venda concluída na loja)
pronto AS (
  SELECT
    l.cod_ordemservicocaixa,
    MIN(CAST(l.datahoraentrada AS DATE)) AS data_pronto
  FROM ordemservicocaixalog l
  JOIN ordemservicocaixa ocx_p
    ON ocx_p.cod_ordemservicocaixa = l.cod_ordemservicocaixa
   AND ocx_p.cod_transacao = CAST(? AS INTEGER)
  WHERE l.cod_etapa IN (5, 6)
  GROUP BY l.cod_ordemservicocaixa
),

-- Primeira passagem pela entrega (etapa 8) — fallback quando DATAENTREGA for nulo
entrega_log AS (
  SELECT
    l.cod_ordemservicocaixa,
    MIN(CAST(l.datahoraentrada AS DATE)) AS data_entrega_log
  FROM ordemservicocaixalog l
  JOIN ordemservicocaixa ocx_e
    ON ocx_e.cod_ordemservicocaixa = l.cod_ordemservicocaixa
   AND ocx_e.cod_transacao = CAST(? AS INTEGER)
  WHERE l.cod_etapa = 8
  GROUP BY l.cod_ordemservicocaixa
),

-- Produto ligado diretamente à OS via TRANSACAO_ITEM.COD_ORDEMSERVICOCAIXA
produtos AS (
  SELECT
    ti.cod_ordemservicocaixa,
    LIST(
      COALESCE(NULLIF(TRIM(ti.descricao), ''), NULLIF(TRIM(i.descricao), '')),
      ' / '
    ) AS produto
  FROM transacao_item ti
  JOIN item i ON i.cod_item = ti.cod_item
  WHERE ti.cod_transacao = CAST(? AS INTEGER)
    AND ti.cod_ordemservicocaixa IS NOT NULL
  GROUP BY ti.cod_ordemservicocaixa
),

-- Fallback: todos os itens da transação (para OS sem link direto)
produtos_tx AS (
  SELECT
    LIST(
      COALESCE(NULLIF(TRIM(ti.descricao), ''), NULLIF(TRIM(i.descricao), '')),
      ' / '
    ) AS produto
  FROM transacao_item ti
  JOIN item i ON i.cod_item = ti.cod_item
  WHERE ti.cod_transacao = CAST(? AS INTEGER)
)

SELECT
  ocx.numeroordemservico                                         AS os_numero,
  CASE
    WHEN pr.data_pronto IS NOT NULL THEN 'producao'
    ELSE 'imediata'
  END                                                            AS classificacao,
  CASE WHEN pr.data_pronto IS NOT NULL THEN 1 ELSE 0 END        AS passou_pronto,
  pr.data_pronto                                                 AS data_pronto,
  COALESCE(ocx.dataentrega, el.data_entrega_log)                AS data_entrega,
  CASE
    WHEN pc.cpf IS NULL THEN NULL
    ELSE NULLIF(TRIM(CAST(pc.cpf AS VARCHAR(20))), '')
  END                                                            AS cpf,
  COALESCE(NULLIF(TRIM(pt.produto), ''),
           NULLIF(TRIM(ptx.produto), ''))                        AS produto
  /*__DATA_NASCIMENTO__*/
FROM ordemservicocaixa ocx
JOIN pessoa pc ON pc.cod_pessoa = ocx.cod_cliente
LEFT JOIN pronto pr ON pr.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN entrega_log el ON el.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN produtos pt ON pt.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN produtos_tx ptx ON 1 = 1
WHERE ocx.cod_transacao = CAST(? AS INTEGER)
  /*__FILTRO_OS_REGULAR__*/
  AND NOT EXISTS (
    SELECT 1
    FROM ordemservicocaixalog l_ult
    WHERE l_ult.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
      AND l_ult.cod_etapa IN (9, 13)
      AND l_ult.datahoraentrada = (
        SELECT MAX(l2.datahoraentrada)
        FROM ordemservicocaixalog l2
        WHERE l2.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
      )
  )
ORDER BY ocx.numeroordemservico
