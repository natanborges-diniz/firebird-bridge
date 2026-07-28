-- queries/vendas/recebimentos_detalhe.sql
-- Parcelas PAGAS no periodo (regime de caixa), por vendedor — base de metas e
-- comissoes (docs/REVISAO_VENDAS_METAS.md §2 e §5.1). Uma linha por parcela.
--
-- Regras de negocio (Natan, 2026-07-28):
--   * valor_recebido = flp.VALORPAGO — NUNCA o previsto flp.VALOR (D9).
--     Parcela sem DATAPAGAMENTO (saldo em aberto) nao entra: nao comissiona
--     e nao soma na meta antes do pagamento.
--   * origem por linha, comparando a emissao da venda com o inicio do periodo
--     consultado: VENDA_PERIODO (t.DATAEMISSAO >= dataIni) ou SALDO_ANTERIOR
--     (parcela de venda emitida antes do periodo). Detalhamento obrigatorio
--     no relatorio do vendedor.
--   * forma_categoria normalizada num unico lugar (resolve D10):
--       tipo 1 (DINHEIRO)            -> AVISTA          (comissao 3%)
--       tipo 2 (CHEQUE)              -> CHEQUE          (1%)
--       tipo 3 + cartao credito='T'  -> CARTAO_CREDITO  (2%)
--       tipo 3 + debito              -> CARTAO_DEBITO   (comissiona como a
--                                       vista/3%, mas categoria separada
--                                       para relatorio)
--       tipo 4 (BANCO)               -> BANCO
--       tipo 5 (CARNE)               -> CREDIARIO       (carne/boleto, 1%)
--       tipo 6 (CREDITOS)            -> CREDITOS        (0% — nao conta em
--                                       meta nem comissao, mas vem
--                                       identificado)
--       demais                       -> OUTROS
--     ATENCAO — BANCO e OUTROS pendentes de validacao: PIX e boleto podem
--     cair nesses tipos. Validar com `npm run validar:recebimentos` antes de
--     fechar o mapeamento de comissao.
--   * Garantia nao e venda: placeholder FILTRO_VENDA_REGULAR trocado em
--     runtime pelo NOT EXISTS contra vendagarantia_item (vendaRegular.js).
--     O literal do placeholder NAO pode aparecer em comentario (split/join
--     substituiria aqui tambem e o bloco viraria SQL solto).
--
-- Anti-timeout (Fase 0/§4 do plano): sem CTE full-table e sem JOIN P ON 1=1 —
-- o filtro principal (datapagamento + empresa) usa parametros DIRETO no
-- WHERE, permitindo indice em FINLANCAMENTOPARCELA.DATAPAGAMENTO.
--
-- Parametros (5):
--   1) dataIni (date) - referencia da origem (VENDA_PERIODO x SALDO_ANTERIOR)
--   2) dataIni (date) - inicio do periodo de pagamento
--   3) dataFim (date) - fim do periodo de pagamento
--   4) empresa (int)
--   5) empresa (int) repetido p/ regra 13/18 (DINIZ SUPER)

SELECT
  t.cod_empresaestoque        AS cod_empresa,
  s.cod_vendedor              AS cod_vendedor,
  v.nome                      AS vendedor_nome,
  t.cod_transacao             AS cod_transacao,
  t.dataemissao               AS dataemissao,
  flp.datapagamento           AS data_pagamento,
  ffp.cod_formapagamentotipo  AS cod_formapagamentotipo,
  -- TRIM: sem ele o CASE devolve CHAR com padding de espacos (comprimento do
  -- maior literal), o que quebraria agregacoes/upserts por chave no Supabase.
  TRIM(CASE ffp.cod_formapagamentotipo
    WHEN 1 THEN 'AVISTA'
    WHEN 2 THEN 'CHEQUE'
    WHEN 3 THEN
      CASE
        WHEN fcct.credito = 'T' THEN 'CARTAO_CREDITO'
        ELSE 'CARTAO_DEBITO'
      END
    WHEN 4 THEN 'BANCO'
    WHEN 5 THEN 'CREDIARIO'
    WHEN 6 THEN 'CREDITOS'
    ELSE 'OUTROS'
  END) AS forma_categoria,
  TRIM(CASE
    WHEN t.dataemissao >= CAST(? AS DATE) THEN 'VENDA_PERIODO'
    ELSE 'SALDO_ANTERIOR'
  END) AS origem,
  COALESCE(flp.valorpago, 0)  AS valor_recebido

FROM finlancamentoparcela flp
JOIN finformapagamento ffp
  ON ffp.cod_formapagamento = flp.cod_formapagamento
JOIN finlancamento fl
  ON fl.cod_lancamento = flp.cod_lancamento
JOIN finfaturatransacao fft
  ON fft.cod_faturatransacao = fl.cod_faturatransacao
JOIN transacao t
  ON t.cod_faturatransacao = fft.cod_faturatransacao
JOIN naturezaoperacao nat
  ON nat.cod_naturezaoperacao = t.cod_naturezaoperacao
 AND nat.tipo = 1
JOIN saida s
  ON s.cod_saida = t.cod_transacao
 AND s.cod_empresa = t.cod_empresa
JOIN pessoa v
  ON v.cod_pessoa = s.cod_vendedor
LEFT JOIN finformapagamentocartao ffpc
  ON ffpc.cod_formapagamentocartao = ffp.cod_formapagamento
LEFT JOIN fincartaocreditotipo fcct
  ON fcct.cod_cartaocreditotipo = ffpc.cod_cartaocreditotipo

WHERE flp.datapagamento BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
  AND flp.valorpago > 0
  AND (
    t.cod_empresaestoque = CAST(? AS INTEGER)
    OR (CAST(? AS INTEGER) IN (13, 18) AND t.cod_empresaestoque IN (13, 18))
  )
  /*__FILTRO_VENDA_REGULAR__*/

ORDER BY
  flp.datapagamento,
  t.cod_transacao;
