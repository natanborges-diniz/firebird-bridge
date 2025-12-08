# Vendas

## Objetivo
Expor resumos gerenciais de vendas por empresa, vendedor, forma de pagamento e família de produto.

## Endpoints
- `GET /api/v1/vendas/resumo-empresa-vendedor`
  - Parâmetros: `dataInicio`, `dataFim` (YYYY-MM-DD).
  - Controller: `src/controllers/vendasController.js` → `resumoEmpresaVendedor`
  - Service: `src/services/vendasService.js` → `getResumoEmpresaVendedor`
  - SQL: `queries/vendas/resumo_empresa_vendedor.sql`
  - Retorno: `{ data: [{ EMPRESA, VENDEDOR, TOTALORIGINAL, TOTALVENDIDO, TICKETMEDIO, TOTALDEVOLUCAO, QTDTRANSACAO, QTDDEVOLUCAO }] }`

- `GET /api/v1/vendas/resumo-formas-pagamento`
  - Parâmetros: `dataInicio`, `dataFim` (YYYY-MM-DD) aplicados aos três blocos (vendas, convênio, devolução).
  - Controller: `src/controllers/vendasController.js` → `resumoFormasPagamento`
  - Service: `src/services/vendasService.js` → `getResumoFormasPagamento`
  - SQL: `queries/vendas/formas_pagamento_resumo.sql`
  - Retorno: `{ data: [{ EMPRESA, VENDEDOR, FORMAPAGAMENTO, TOTALGERAL, QTD_VENDAS }] }`

- `GET /api/v1/vendas/analise-familia-vendedor`
  - Parâmetros: `dataInicio`, `dataFim` (YYYY-MM-DD), `codEmpresa` opcional.
  - Controller: `src/controllers/vendasAnaliseController.js` → `analiseFamiliaVendedor`
  - Service: `src/services/vendasAnaliseService.js` → `getAnaliseFamiliaVendedor`
  - SQL: `queries/vendas/analise_familia_vendedor.sql`
  - Retorno: `{ data: [{ COD_EMPRESA, EMPRESA, COD_VENDEDOR, VENDEDOR, FAMILIA, QTD_TRANSACAO, QTD_PRODUTOS, TOTAL_VENDIDO }] }`

## Fluxo interno
1. Controllers validam obrigatórios (`dataInicio`, `dataFim`) e fazem cast de `codEmpresa` quando presente.
2. Services carregam SQL via `loadSQL` e executam com `runQuery` do `src/db/index.js`.
3. Resposta é envelopada em `{ data }` e enviada ao frontend.

## Tabelas/Views consultadas
- Transações de venda: `transacao`, `transacao_item`, `saida`, `naturezaoperacao`, `pessoa` (empresas e vendedores), `fin` tabelas para formas de pagamento, `transacaoconvenioparcela`, `produtofamilia`.

## Consumo no frontend
- Frontend Lovable consulta endpoints de resumo para alimentar dashboards de vendas; filtros de data e empresa seguem os parâmetros listados acima. (Não há hook específico versionado aqui, o consumo é direto da API.)

## Filtros e métricas
- Filtros: intervalo de data obrigatório; empresa opcional na análise por família.
- Métricas principais: total vendido/original, ticket médio, quantidade de transações/devoluções, total por forma de pagamento, volume por família e vendedor.
