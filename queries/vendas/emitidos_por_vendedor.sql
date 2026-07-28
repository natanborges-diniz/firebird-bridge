-- queries/vendas/emitidos_por_vendedor.sql
-- Modo alternativo "emitido em OS" (docs/REVISAO_VENDAS_METAS.md §2 e §5.1):
-- vendas por transacao com filtro em t.DATAEMISSAO, valores da venda (itens),
-- nao das parcelas. Usado quando o gestor escolhe o modo EMITIDO no
-- fechamento de comissao. Simples e leve: uma linha por transacao.
--
--   * valor_emitido = SUM(TOTAL - VALORDESCONTO - TOTALIPI) dos itens —
--     definicao padronizada de faturamento (D1).
--   * Garantia nao e venda: placeholder FILTRO_VENDA_REGULAR injetado em
--     runtime (o literal do placeholder NAO pode aparecer em comentario:
--     o split/join do vendaRegular.js substituiria aqui tambem e o bloco
--     multi-linha viraria SQL solto — foi exatamente o bug do -104).
--   * Anti-timeout: parametros direto no WHERE (sem CTE full-table).
--
-- Parametros (4):
--   1) dataIni (date)
--   2) dataFim (date)
--   3) empresa (int)
--   4) empresa (int) repetido p/ regra 13/18 (DINIZ SUPER)

SELECT
  t.cod_empresaestoque AS cod_empresa,
  s.cod_vendedor       AS cod_vendedor,
  v.nome               AS vendedor_nome,
  t.cod_transacao      AS cod_transacao,
  t.dataemissao        AS dataemissao,
  SUM(
    COALESCE(ti.total, 0)
    - COALESCE(ti.valordesconto, 0)
    - COALESCE(ti.totalipi, 0)
  ) AS valor_emitido

FROM transacao t
JOIN naturezaoperacao nat
  ON nat.cod_naturezaoperacao = t.cod_naturezaoperacao
 AND nat.tipo = 1
JOIN saida s
  ON s.cod_saida = t.cod_transacao
 AND s.cod_empresa = t.cod_empresa
JOIN pessoa v
  ON v.cod_pessoa = s.cod_vendedor
JOIN transacao_item ti
  ON ti.cod_transacao = t.cod_transacao
 AND ti.cod_empresa = t.cod_empresa

WHERE t.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
  AND (
    t.cod_empresaestoque = CAST(? AS INTEGER)
    OR (CAST(? AS INTEGER) IN (13, 18) AND t.cod_empresaestoque IN (13, 18))
  )
  /*__FILTRO_VENDA_REGULAR__*/

GROUP BY
  t.cod_empresaestoque,
  s.cod_vendedor,
  v.nome,
  t.cod_transacao,
  t.dataemissao

ORDER BY
  t.dataemissao,
  t.cod_transacao;
