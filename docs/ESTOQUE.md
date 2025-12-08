# Estoque

## Objetivo
Fornecer análise de estoque com ação sugerida por produto/grife/fornecedor, considerando saldo, CAF e última entrada.

## Endpoint
- `GET /api/v1/estoque/analise-acao`
  - Parâmetros (query): `codEmpresa` (obrigatório, numérico).
  - Controller: `src/controllers/estoqueController.js` → `analiseEstoqueAcao`
  - Service: `src/services/estoqueService.js` → `getAnaliseEstoqueAcao`
  - SQL: `queries/estoque/analise_estoque_acao.sql`
  - Resposta: `{ data: [{ EMPRESA, cod_pessoa, nome_fornecedor, grife, codigo_barra, descricao_produto, quantidade_estoque, caf, data_ultima_entrada, dias_estoque, acao_sugerida }] }`

## Fluxo interno
1. Controller valida presença e formato numérico de `codEmpresa`.
2. Service chama `runQuery` com o código da empresa como único parâmetro.
3. Query calcula saldo agregado, CAF, última entrada e derivação de `acao_sugerida` por faixa de dias em estoque.

## Tabelas/Views consultadas
- `estoque`, `produto`, `item`, `fornecedor_item`, `pessoa`, classificações (`itemclassificacao`, `item_itemclassificacao`), transações de entrada (`transacao`, `entrada`, `transacao_item`, `naturezaoperacao`), ordens de compra para CAF.

## Consumo no frontend
- Endpoint alimenta painéis de estoque no Lovable; filtros aplicam apenas `codEmpresa`. O front recebe a ação sugerida já calculada para exibição.

## Filtros e métricas
- Filtro único: empresa.
- Métricas: saldo disponível, CAF, dias desde última entrada e texto `acao_sugerida` (ex.: “ANALISE PARA RECOMPRA”, “LIQUIDA 30%”).
