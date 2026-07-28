-- queries/vendas/devolucoes_restituicao.sql
-- PENDENTE VALIDACAO (npm run validar:recebimentos)
--
-- Devolucoes com RESTITUICAO de valores ao cliente (sem geracao de credito),
-- por vendedor, no periodo — abatem meta e comissao na semana da restituicao
-- (docs/REVISAO_VENDAS_METAS.md §2 "Devolucoes — regra dupla" e §5.1).
--
-- HIPOTESE (ainda NAO validada contra o schema real — best-effort da Fase 1):
--   * Devolucao = transacao ligada a ENTRADANOTAFISCALDEVOLUCAO
--     (transacao.cod_transacao = enfd.cod_entradanotafiscaldevolucao, mesma
--     ligacao do bloco DEVOLUCAO de formas_pagamento_resumo.sql; vendedor em
--     enfd.cod_vendedor).
--   * Devolucao COM RESTITUICAO = a transacao de devolucao possui lancamento
--     financeiro (cadeia cod_faturatransacao -> finlancamento ->
--     finlancamentoparcela) com parcela PAGA (datapagamento preenchido,
--     valorpago > 0) em forma de pagamento de tipo <> 6.
--   * Devolucao COM GERACAO DE CREDITO = o movimento financeiro sai na forma
--     tipo 6 (CREDITOS) — excluida aqui, pois credito gerado nao abate meta
--     nem comissao (o credito nunca conta em nenhuma ponta, fechando o ciclo
--     sem dupla contagem).
--   * data_restituicao = flp.datapagamento (semana em que o valor saiu).
--
-- Se a hipotese falhar na validacao (ex.: devolucao nao gera fatura/lancamento
-- proprio), esta query devolve vazio sem quebrar — e o service ja faz fallback
-- gracioso via hasTable/hasColumn quando o schema nao tem as tabelas/colunas.
--
-- Parametros (4):
--   1) dataIni (date) - inicio do periodo (datapagamento da restituicao)
--   2) dataFim (date) - fim do periodo
--   3) empresa (int)
--   4) empresa (int) repetido p/ regra 13/18 (DINIZ SUPER)

SELECT
  td.cod_empresaestoque AS cod_empresa,
  enfd.cod_vendedor     AS cod_vendedor,
  v.nome                AS vendedor_nome,
  td.cod_transacao      AS cod_transacao,
  td.dataemissao        AS dataemissao,
  flp.datapagamento     AS data_restituicao,
  SUM(COALESCE(flp.valorpago, 0)) AS valor_restituido

FROM finlancamentoparcela flp
JOIN finformapagamento ffp
  ON ffp.cod_formapagamento = flp.cod_formapagamento
JOIN finlancamento fl
  ON fl.cod_lancamento = flp.cod_lancamento
JOIN finfaturatransacao fft
  ON fft.cod_faturatransacao = fl.cod_faturatransacao
JOIN transacao td
  ON td.cod_faturatransacao = fft.cod_faturatransacao
JOIN entradanotafiscaldevolucao enfd
  ON enfd.cod_entradanotafiscaldevolucao = td.cod_transacao
 AND enfd.cod_empresa = td.cod_empresa
JOIN pessoa v
  ON v.cod_pessoa = enfd.cod_vendedor

WHERE flp.datapagamento BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
  AND flp.valorpago > 0
  -- credito gerado (tipo 6) NAO e restituicao: nao abate meta/comissao
  AND ffp.cod_formapagamentotipo <> 6
  AND (
    td.cod_empresaestoque = CAST(? AS INTEGER)
    OR (CAST(? AS INTEGER) IN (13, 18) AND td.cod_empresaestoque IN (13, 18))
  )

GROUP BY
  td.cod_empresaestoque,
  enfd.cod_vendedor,
  v.nome,
  td.cod_transacao,
  td.dataemissao,
  flp.datapagamento

ORDER BY
  flp.datapagamento,
  td.cod_transacao;
