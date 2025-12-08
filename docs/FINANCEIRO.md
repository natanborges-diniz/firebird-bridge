# Financeiro

## Objetivo
Concentrar visão de parcelas (a pagar/receber) e DRE gerencial com base na competência de emissão das parcelas.

## Endpoints
- `GET /api/v1/financeiro/parcelas`
  - Parâmetros (query):
    - `dataIni` (YYYY-MM-DD)
    - `dataFim` (YYYY-MM-DD)
    - `empresa` (código interno da empresa)
  - Controller: `src/controllers/financeiroController.js` → `listarParcelas`
  - Service: `src/services/financeiroService.js` → `getParcelas`
  - SQL: `queries/financeiro/financeiro_parcelas.sql`
  - Resposta: `{ ok: true, count, rows: [...] }` onde cada linha traz empresa, contraparte, forma de pagamento, datas de vencimento/pagamento e situação calculada (`PAGA`, `EM ATRASO`, `EM ABERTO`).

- `GET /api/v1/financeiro/dre`
  - Parâmetros (query):
    - `dataIni` (YYYY-MM-DD)
    - `dataFim` (YYYY-MM-DD)
    - `empresa` (código interno da empresa)
  - Controller: `src/controllers/financeiroController.js` → `listarDre`
  - Service: `src/services/financeiroService.js` → `getDre`
  - SQL: `queries/financeiro/financeiro_dre.sql`
  - Resposta: `{ ok: true, count, rows: [...] }` agregando `total_receitas`, `total_despesas`, `resultado` por `competencia_label` (`YYYY-MM`).

## Fluxo interno
1. Controller valida parâmetros obrigatórios e devolve `400` em caso de falta.
2. Service carrega SQL via `loadSql` (leitura síncrona do arquivo em `queries/financeiro`).
3. `db.query` (alias de `runQuery`) executa com os parâmetros na ordem definida no `.sql`.
4. Controller envelopa o resultado (`ok`, `count`, `rows`).

## Tabelas/Views consultadas
- Parcelas: `finlancamento`, `finlancamentoparcela`, `fincontaclassificacao`, `finformapagamento`, `pessoa` (empresa e cliente/fornecedor).
- DRE: `finlancamento`, `finlancamentoparcela`, `pessoa` (empresa).

## Consumo no frontend (Lovable)
- Hook `src/hooks/useFinanceiroDashboard.ts` chama `getFinanceiroParcelas` (service do frontend) que atinge `/api/v1/financeiro/parcelas`.
- Componente `src/components/financeiro/FinanceiroDashboardLayout.tsx` exibe filtros (`empresaId`, `dataIni`, `dataFim`) e métricas derivadas (`totalReceberAberto`, `totalPagarAberto`, atrasos, fluxo diário).
- Rota frontend: telas ligadas a `/financeiro` usam o hook para montar gráficos/listas de parcelas; métricas e `dailyFlow` são calculados client-side a partir da resposta.

## Filtros e métricas disponíveis
- Filtros: empresa, data inicial/final.
- Métricas calculadas no front: total a receber/pagar em aberto, atrasos, total vencendo hoje, fluxo diário de vencimentos.
- Campos entregues pela API incluem valores originais/pagos, situação da parcela e tipologia da forma de pagamento.
