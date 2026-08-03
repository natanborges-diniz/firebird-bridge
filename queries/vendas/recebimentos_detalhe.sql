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
  t.numerotransacao           AS numero_venda,
  nfe.numeronotafiscal        AS numero_nf,
  COALESCE((SELECT CAST(LIST(TRIM(ocx.cod_ordemservicocaixa || ''), ',') AS VARCHAR(500))
     FROM ordemservicocaixa ocx
    WHERE ocx.cod_transacao = t.cod_transacao), 'SEM_OS') AS os_list,
  t.dataemissao               AS dataemissao,
  t.dataemissao               AS data_pagamento,
  ffp.cod_formapagamentotipo  AS cod_formapagamentotipo,
  TRIM(CASE
    WHEN UPPER(COALESCE(fcct.nome, '')) LIKE '%PIX%' THEN 'PIX'
    WHEN fcct.credito = 'T' THEN 'CARTAO_CREDITO'
    ELSE 'CARTAO_DEBITO'
  END) AS forma_categoria,
  'VENDA_PERIODO'             AS origem,
  COALESCE(NULLIF(flp.valorpago, 0), flp.valor) AS valor_recebido,
  -- fatura compartilhada por N transacoes da mesma venda: o service usa
  -- cod_fatura p/ deduplicar (parcela conta 1x, na transacao canonica)
  t.cod_faturatransacao       AS cod_fatura,
  -- p/ corte de juros de parcelamento no service (base <= valor da venda):
  -- valor emitido da transacao (itens) e total previsto da fatura (parcelas)
  COALESCE((SELECT SUM(COALESCE(ti.total, 0) - COALESCE(ti.valordesconto, 0) - COALESCE(ti.totalipi, 0))
     FROM transacao_item ti
    WHERE ti.cod_transacao = t.cod_transacao
      AND ti.cod_empresa = t.cod_empresa), 0) AS valor_emitido,
  COALESCE((SELECT SUM(COALESCE(flp2.valor, 0))
     FROM finlancamento fl2
     JOIN finlancamentoparcela flp2 ON flp2.cod_lancamento = fl2.cod_lancamento
    WHERE fl2.cod_faturatransacao = t.cod_faturatransacao
      AND fl2.pagar = 'F'), 0) AS fatura_previsto

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
LEFT JOIN notafiscalemitida nfe
  ON nfe.cod_notafiscalemitida = t.cod_notafiscalemitida

WHERE t.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
  -- bandeira interna 'SALDO A RECEBER' NAO e cartao (e saldo em aberto)
  AND UPPER(TRIM(COALESCE(fcct.nome, ''))) <> 'SALDO A RECEBER'
  -- QUITACAO de saldo em cartao NAO e processamento do ato (Natan, 2026-08-02):
  -- comissiona na quitacao, no bloco B. Marcador validado em producao:
  -- a parcela de quitacao tem o vencimento alterado (venc <> venc original);
  -- parcelas do cartao passado no ato nunca tem.
  AND (flp.datavencimentooriginal IS NULL
       OR flp.datavencimento = flp.datavencimentooriginal)
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
  t.numerotransacao           AS numero_venda,
  nfe.numeronotafiscal        AS numero_nf,
  COALESCE((SELECT CAST(LIST(TRIM(ocx.cod_ordemservicocaixa || ''), ',') AS VARCHAR(500))
     FROM ordemservicocaixa ocx
    WHERE ocx.cod_transacao = t.cod_transacao), 'SEM_OS') AS os_list,
  t.dataemissao               AS dataemissao,
  -- QUITACAO de saldo em cartao: processa INTEGRAL na data da quitacao,
  -- mesmo se parcelada. Validado em producao (venda 86274): TODAS as parcelas
  -- da quitacao tem DATARECEBIMENTO = dia da quitacao (o vencimento
  -- reprogramado e o calendario da adquirente). Demais formas: pagamento
  -- efetivo da parcela.
  CASE
    WHEN ffp.cod_formapagamentotipo = 3
     AND UPPER(TRIM(COALESCE(fcct.nome, ''))) <> 'SALDO A RECEBER'
     AND flp.datavencimentooriginal IS NOT NULL
     AND flp.datavencimento <> flp.datavencimentooriginal
    THEN COALESCE(flp.datarecebimento, flp.datapagamento, flp.datavencimento)
    ELSE COALESCE(flp.datapagamento, flp.datarecebimento)
  END                         AS data_pagamento,
  ffp.cod_formapagamentotipo  AS cod_formapagamentotipo,
  TRIM(CASE
    -- tipo 3 aqui = bandeira interna (saldo pago sem forma identificada) OU
    -- QUITACAO de saldo em cartao (venc <> venc original): categoria do
    -- cartao REAL para aplicar a taxa certa
    WHEN ffp.cod_formapagamentotipo = 3
     AND UPPER(TRIM(COALESCE(fcct.nome, ''))) = 'SALDO A RECEBER' THEN 'OUTROS'
    WHEN ffp.cod_formapagamentotipo = 3
     AND UPPER(COALESCE(fcct.nome, '')) LIKE '%PIX%' THEN 'PIX'
    WHEN ffp.cod_formapagamentotipo = 3
     AND fcct.credito = 'T' THEN 'CARTAO_CREDITO'
    WHEN ffp.cod_formapagamentotipo = 3 THEN 'CARTAO_DEBITO'
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
  -- pago pode estar em valorpago ou, quando baixado por recebimento, so em valor
  COALESCE(NULLIF(flp.valorpago, 0), flp.valor) AS valor_recebido,
  t.cod_faturatransacao       AS cod_fatura,
  COALESCE((SELECT SUM(COALESCE(ti.total, 0) - COALESCE(ti.valordesconto, 0) - COALESCE(ti.totalipi, 0))
     FROM transacao_item ti
    WHERE ti.cod_transacao = t.cod_transacao
      AND ti.cod_empresa = t.cod_empresa), 0) AS valor_emitido,
  COALESCE((SELECT SUM(COALESCE(flp2.valor, 0))
     FROM finlancamento fl2
     JOIN finlancamentoparcela flp2 ON flp2.cod_lancamento = fl2.cod_lancamento
    WHERE fl2.cod_faturatransacao = t.cod_faturatransacao
      AND fl2.pagar = 'F'), 0) AS fatura_previsto

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
LEFT JOIN notafiscalemitida nfe
  ON nfe.cod_notafiscalemitida = t.cod_notafiscalemitida

WHERE CASE
    WHEN ffp.cod_formapagamentotipo = 3
     AND UPPER(TRIM(COALESCE(fcct.nome, ''))) <> 'SALDO A RECEBER'
     AND flp.datavencimentooriginal IS NOT NULL
     AND flp.datavencimento <> flp.datavencimentooriginal
    THEN COALESCE(flp.datarecebimento, flp.datapagamento, flp.datavencimento)
    ELSE COALESCE(flp.datapagamento, flp.datarecebimento)
  END BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
  AND COALESCE(NULLIF(flp.valorpago, 0), flp.valor) > 0
  -- cartoes passados no ATO ja comissionaram no processamento (bloco A);
  -- do tipo 3 entram aqui: a bandeira interna 'SALDO A RECEBER' paga e a
  -- QUITACAO de saldo feita em cartao (venc <> venc original)
  AND (
    ffp.cod_formapagamentotipo <> 3
    OR UPPER(TRIM(COALESCE(fcct.nome, ''))) = 'SALDO A RECEBER'
    OR (flp.datavencimentooriginal IS NOT NULL
        AND flp.datavencimento <> flp.datavencimentooriginal)
  )
  AND (
    t.cod_empresaestoque = CAST(? AS INTEGER)
    OR (CAST(? AS INTEGER) IN (13, 18) AND t.cod_empresaestoque IN (13, 18))
  )
  /*__FILTRO_VENDA_REGULAR__*/

ORDER BY 9, 4
