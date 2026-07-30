-- queries/vendas/recebimentos_detalhe.sql
-- Base de metas e comissoes por vendedor — uma linha por parcela.
--
-- REGRA DE REGIME (Natan, 2026-07-28):
--   * CARTOES (tipo 3: credito, debito, PIX-bandeira): comissionam no
--     PROCESSAMENTO do cartao (emissao da venda), com o VALOR INTEGRAL de
--     todas as parcelas, pagas ou futuras — cartao nao tem inadimplencia.
--     Nunca geram "saldo a receber". (Bloco A: filtro por t.dataemissao.)
--   * DEMAIS FORMAS (dinheiro, cheque, boleto/tipo 4, carne/tipo 5,
--     convenio): comissionam no PAGAMENTO do cliente (datapagamento,
--     valorpago) — essas sim tem inadimplencia. (Bloco B.)
--   * Bandeira interna 'SALDO A RECEBER' (fincartaocreditotipo cod 11) NAO e
--     cartao de verdade: e o saldo em aberto registrado pelo ERP. Fica FORA
--     do bloco A; quando o saldo e pago, entra no bloco B como OUTROS
--     (a forma real do pagamento do saldo deve ser validada com o ERP).
--   * CREDITOS (tipo 6): 0%, fora de meta — mas vem identificado.
--   * origem: VENDA_PERIODO (venda emitida no periodo) | SALDO_ANTERIOR.
--     No bloco A e sempre VENDA_PERIODO (regime = emissao).
--   * os_list: OS que compoem a venda (ordemservicocaixa.cod_transacao).
--   * Garantia nao e venda: placeholder FILTRO_VENDA_REGULAR trocado em
--     runtime (o literal do placeholder NAO pode aparecer em comentario).
--
-- Parametros (9):
--   Bloco A: 1) dataIni  2) dataFim  3) empresa  4) empresa (regra 13/18)
--   Bloco B: 5) dataIni (origem)  6) dataIni  7) dataFim
--            8) empresa  9) empresa (regra 13/18)

-- ============ BLOCO A: cartoes por PROCESSAMENTO (emissao) ============
SELECT
  t.cod_empresaestoque        AS cod_empresa,
  s.cod_vendedor              AS cod_vendedor,
  v.nome                      AS vendedor_nome,
  t.cod_transacao             AS cod_transacao,
  (SELECT LIST(TRIM(ocx.cod_ordemservicocaixa || ''), ',')
     FROM ordemservicocaixa ocx
    WHERE ocx.cod_transacao = t.cod_transacao) AS os_list,
  t.dataemissao               AS dataemissao,
  t.dataemissao               AS data_pagamento,
  ffp.cod_formapagamentotipo  AS cod_formapagamentotipo,
  TRIM(CASE
    WHEN UPPER(COALESCE(fcct.nome, '')) LIKE '%PIX%' THEN 'PIX'
    WHEN fcct.credito = 'T' THEN 'CARTAO_CREDITO'
    ELSE 'CARTAO_DEBITO'
  END) AS forma_categoria,
  'VENDA_PERIODO'             AS origem,
  COALESCE(NULLIF(flp.valorpago, 0), flp.valor) AS valor_recebido

FROM finlancamentoparcela flp
JOIN finformapagamento ffp
  ON ffp.cod_formapagamento = flp.cod_formapagamento
 AND ffp.cod_formapagamentotipo = 3
JOIN finlancamento fl
  ON fl.cod_lancamento = flp.cod_lancamento
 -- somente contas a RECEBER: comissao/meta nunca olham contas pagas
 AND fl.pagar = 'F'
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

WHERE t.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
  -- bandeira interna 'SALDO A RECEBER' NAO e cartao (e saldo em aberto)
  AND UPPER(TRIM(COALESCE(fcct.nome, ''))) <> 'SALDO A RECEBER'
  AND (
    t.cod_empresaestoque = CAST(? AS INTEGER)
    OR (CAST(? AS INTEGER) IN (13, 18) AND t.cod_empresaestoque IN (13, 18))
  )
  /*__FILTRO_VENDA_REGULAR__*/

UNION ALL

-- ============ BLOCO B: demais formas por PAGAMENTO do cliente ============
SELECT
  t.cod_empresaestoque        AS cod_empresa,
  s.cod_vendedor              AS cod_vendedor,
  v.nome                      AS vendedor_nome,
  t.cod_transacao             AS cod_transacao,
  (SELECT LIST(TRIM(ocx.cod_ordemservicocaixa || ''), ',')
     FROM ordemservicocaixa ocx
    WHERE ocx.cod_transacao = t.cod_transacao) AS os_list,
  t.dataemissao               AS dataemissao,
  flp.datapagamento           AS data_pagamento,
  ffp.cod_formapagamentotipo  AS cod_formapagamentotipo,
  TRIM(CASE
    WHEN ffp.cod_formapagamentotipo = 3 THEN 'OUTROS'
    WHEN ffp.cod_formapagamentotipo = 1 THEN 'AVISTA'
    WHEN ffp.cod_formapagamentotipo = 2 THEN 'CHEQUE'
    WHEN ffp.cod_formapagamentotipo = 4 THEN 'CREDIARIO'
    WHEN ffp.cod_formapagamentotipo = 5 THEN 'CREDIARIO'
    WHEN ffp.cod_formapagamentotipo = 6 THEN 'CREDITOS'
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
 AND fl.pagar = 'F'
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
  -- cartoes de verdade ja comissionaram no processamento (bloco A);
  -- do tipo 3 so entra aqui a bandeira interna 'SALDO A RECEBER' paga
  AND (
    ffp.cod_formapagamentotipo <> 3
    OR UPPER(TRIM(COALESCE(fcct.nome, ''))) = 'SALDO A RECEBER'
  )
  AND (
    t.cod_empresaestoque = CAST(? AS INTEGER)
    OR (CAST(? AS INTEGER) IN (13, 18) AND t.cod_empresaestoque IN (13, 18))
  )
  /*__FILTRO_VENDA_REGULAR__*/

ORDER BY 7, 4
