-- queries/vendas/saldos_em_aberto.sql
-- SALDOS A RECEBER em aberto por vendedor (Natan, 2026-07-28): parcelas SEM
-- pagamento de formas que TEM inadimplencia. Cartoes de verdade ficam fora
-- (comissionam no processamento, sem risco); a bandeira interna
-- 'SALDO A RECEBER' (tipo 3, cod 11) ENTRA — e o proprio saldo em aberto do
-- ERP. Quando o saldo for pago, a comissao assume a forma do pagamento
-- (bloco B do recebimentos_detalhe).
--
-- Uma linha por parcela em aberto de vendas EMITIDAS no periodo consultado.
-- os_list = OS que compoem a venda. Garantia excluida em runtime.
--
-- Parametros (4): dataIni, dataFim (emissao da venda), empresa, empresa (13/18)

SELECT
  t.cod_empresaestoque        AS cod_empresa,
  s.cod_vendedor              AS cod_vendedor,
  v.nome                      AS vendedor_nome,
  t.cod_transacao             AS cod_transacao,
  (SELECT CAST(LIST(TRIM(ocx.cod_ordemservicocaixa || ''), ',') AS VARCHAR(500))
     FROM ordemservicocaixa ocx
    WHERE ocx.cod_transacao = t.cod_transacao) AS os_list,
  t.dataemissao               AS dataemissao,
  flp.datavencimento          AS data_vencimento,
  ffp.cod_formapagamentotipo  AS cod_formapagamentotipo,
  TRIM(CASE
    WHEN ffp.cod_formapagamentotipo = 3 THEN 'SALDO_A_RECEBER'
    WHEN ffp.cod_formapagamentotipo = 2 THEN 'CHEQUE'
    WHEN ffp.cod_formapagamentotipo = 4 THEN 'CREDIARIO'
    WHEN ffp.cod_formapagamentotipo = 5 THEN 'CREDIARIO'
    ELSE 'OUTROS'
  END) AS forma_categoria,
  COALESCE(flp.valor, 0)      AS valor_aberto

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

WHERE t.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
  AND flp.datapagamento IS NULL
  AND COALESCE(flp.valor, 0) > 0
  -- creditos (tipo 6) nao sao saldo do cliente; cartoes de verdade nao geram
  -- saldo (comissionados no processamento) — do tipo 3 so a bandeira interna
  AND ffp.cod_formapagamentotipo <> 6
  AND (
    ffp.cod_formapagamentotipo <> 3
    OR UPPER(TRIM(COALESCE(fcct.nome, ''))) = 'SALDO A RECEBER'
  )
  AND (
    t.cod_empresaestoque = CAST(? AS INTEGER)
    OR (CAST(? AS INTEGER) IN (13, 18) AND t.cod_empresaestoque IN (13, 18))
  )
  /*__FILTRO_VENDA_REGULAR__*/

ORDER BY s.cod_vendedor, t.cod_transacao, flp.datavencimento
