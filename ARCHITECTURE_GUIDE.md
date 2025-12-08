# Firebird Bridge – Architecture Guide

Este documento fotografa o estado **atual** do projeto e serve como referência rápida para navegação e padronização.

## Visão geral da arquitetura

Fluxo ponta a ponta:
- **Firebird (Dataweb)** → origem de dados e autenticação.
- **firebird-bridge (Railway)** → API Express que executa SQLs pré-definidos no Firebird.
- **Supabase/Lovable** → hospeda o frontend React (Lovable) que consome os endpoints REST do bridge.
- **Frontend** → dashboards e telas que leem apenas a API pública do Railway.

## Estrutura de pastas (back-end)

```
queries/
  empresas/
  estoque/
  financeiro/
  os/
  vendas/

src/
  controllers/
  routes/
  services/
  db/
  config/
  utils/
  components/      (componentes React usados pelo frontend Lovable)
  hooks/           (hooks React que consomem a API do bridge)
  pages/           (páginas React do frontend)
```

Arquivos importantes:
- `src/db/index.js`: client nativo do Firebird e utilitários de query.
- `src/config/env.js`: validação mínima de variáveis obrigatórias.
- `src/utils/loadSQL.js`: helper para carregar `.sql` em `queries/`.
- `src/routes/index.js`: monta o router `/api/v1/...` e `/health`.

## Padrão de uso: db e env

### `src/db/index.js`
- Usa `node-firebird-driver-native` com `createNativeClient`.
- `buildConnectString()` monta `"${FIREBIRD_HOST}:${FIREBIRD_DATABASE}"` após `validateEnv()` garantir `FIREBIRD_HOST` e `FIREBIRD_DATABASE`.
- Credenciais: `FIREBIRD_USER` (padrão `SYSDBA`) e `FIREBIRD_PASSWORD` (padrão `masterkey`).
- Exporta:
  - `runQuery(sql, params, metadata?)` / alias `query`: abre conexão, inicia transação, executa e faz commit/rollback, logando duração.
  - `pingDatabase()`: `SELECT 1 AS alive` para healthcheck.
  - `getFirebirdConnectString()`: reutiliza `buildConnectString()` (usado em validações de ambiente).

### `src/config/env.js`
- Carrega `.env` com `dotenv`.
- `requiredKeys = ['FIREBIRD_HOST', 'FIREBIRD_DATABASE']`.
- `assertEnv()` lança erro listando variáveis faltantes; usada em bootstrap/health.

## Módulos e endpoints (backend)

### Vendas
- **Rotas**: `src/routes/vendas.routes.js`
  - `GET /api/v1/vendas/resumo-empresa-vendedor`
  - `GET /api/v1/vendas/resumo-formas-pagamento`
  - `GET /api/v1/vendas/analise-familia-vendedor`
- **Controllers**: `src/controllers/vendasController.js`, `src/controllers/vendasAnaliseController.js`
- **Services**: `src/services/vendasService.js`, `src/services/vendasAnaliseService.js`
- **SQL**: `queries/vendas/resumo_empresa_vendedor.sql`, `queries/vendas/formas_pagamento_resumo.sql`, `queries/vendas/analise_familia_vendedor.sql`
- **Parâmetros**:
  - Resumo por empresa/vendedor: `dataInicio`, `dataFim` (YYYY-MM-DD).
  - Formas de pagamento: `dataInicio`, `dataFim` (YYYY-MM-DD) aplicados aos três blocos da query.
  - Análise família/vendedor: `dataInicio`, `dataFim`, `codEmpresa` opcional.
- **Respostas**:
  - `resumo-empresa-vendedor`: `{ data: [{ EMPRESA, VENDEDOR, TOTALORIGINAL, TOTALVENDIDO, TICKETMEDIO, TOTALDEVOLUCAO, QTDTRANSACAO, QTDDEVOLUCAO }] }`.
  - `resumo-formas-pagamento`: `{ data: [{ EMPRESA, VENDEDOR, FORMAPAGAMENTO, TOTALGERAL, QTD_VENDAS }] }`.
  - `analise-familia-vendedor`: `{ data: [{ COD_EMPRESA, EMPRESA, COD_VENDEDOR, VENDEDOR, FAMILIA, QTD_TRANSACAO, QTD_PRODUTOS, TOTAL_VENDIDO }] }`.

### Estoque
- **Rota**: `src/routes/estoque.routes.js`
  - `GET /api/v1/estoque/analise-acao?codEmpresa=<id>`
- **Controller**: `src/controllers/estoqueController.js`
- **Service**: `src/services/estoqueService.js`
- **SQL**: `queries/estoque/analise_estoque_acao.sql` (1 parâmetro `cod_empresa`).
- **Resposta**: `{ data: [{ EMPRESA, cod_pessoa (fornecedor), nome_fornecedor, grife, codigo_barra, descricao_produto, quantidade_estoque, caf, data_ultima_entrada, dias_estoque, acao_sugerida }] }`.

### Ordens de Serviço (OS / monitor de produção)
- **Rota**: `src/routes/os.routes.js`
  - `GET /api/v1/os/monitor`
- **Controller**: `src/controllers/osController.js` (versão otimizada em linha).
- **Service (alternativo)**: `src/services/osService.js` carrega `queries/os/monitor_producao.sql` (a rota atual usa SQL inline, mas o serviço filtra o mesmo resultado quando necessário).
- **Parâmetros**: `dataInicio`, `dataFim` obrigatórios; `codEmpresa` opcional.
- **Resposta**: lista de OS com etapa atual e datas `{ EMPRESA, OS, TOTAL, DATAEMISSAO, DATAPREVISAO, CLIENTE, CODCLIENTE, CODETAPA_ATUAL, DATAHORAENTRADA_ULTIMA, DATAHORASAIDA_ULTIMA, IS_REPARO, IS_ECOMMERCE }` (mais campos do select inline ou da query de monitor).

### Empresas
- **Rota**: `src/routes/empresas.routes.js`
  - `GET /api/v1/empresas`
- **Controller**: `src/controllers/empresaController.js`
- **Service**: `src/services/empresaService.js`
- **SQL**: `queries/empresas/listar_empresas.sql`
- **Resposta**: `{ data: [{ COD_EMPRESA, EMPRESA }] }`.

### Financeiro
- **Rotas**: `src/routes/financeiro.routes.js`
  - `GET /api/v1/financeiro/parcelas`
  - `GET /api/v1/financeiro/dre`
- **Controller**: `src/controllers/financeiroController.js`
- **Service**: `src/services/financeiroService.js`
- **SQL**: `queries/financeiro/financeiro_parcelas.sql`, `queries/financeiro/financeiro_dre.sql`
- **Parâmetros**: `dataIni`, `dataFim` (YYYY-MM-DD), `empresa` (código interno) para ambos.
- **Respostas**:
  - `parcelas`: `{ ok: true, count, rows: [...] }` contendo campos calculados de situação, forma de pagamento e valores.
  - `dre`: `{ ok: true, count, rows: [...] }` agregando `total_receitas`, `total_despesas`, `resultado` por competência.

## Como validar ambiente / conectar
1. Defina `FIREBIRD_HOST` e `FIREBIRD_DATABASE` (obrigatórios). `FIREBIRD_USER` / `FIREBIRD_PASSWORD` são opcionais com defaults.
2. O healthcheck `GET /health?checkDb=true` usa `pingDatabase()` para testar a conexão.
3. Qualquer service deve usar `runQuery` do `src/db/index.js` e carregar SQLs via `loadSQL` apontando para `queries/<modulo>/...`.
