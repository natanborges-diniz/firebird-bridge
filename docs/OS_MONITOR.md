# Ordens de Serviço (Monitor de Produção)

## Objetivo
Exibir acompanhamento das OS com etapa atual, datas de entrada/saída e identificação de empresa/cliente.

## Endpoint
- `GET /api/v1/os/monitor`
  - Parâmetros (query):
    - `dataInicio` (YYYY-MM-DD)
    - `dataFim` (YYYY-MM-DD)
    - `codEmpresa` (opcional, numérico)
  - Controller: `src/controllers/osController.js` → `monitorOs`
  - Service alternativo: `src/services/osService.js` → `getMonitorProducao` (usa `queries/os/monitor_producao.sql` e filtra `codEmpresa` em memória; a rota atual usa SQL inline semelhante).
  - Resposta: array com campos de OS, etapa e timestamps. Ex.: `{ EMPRESA, OS, TOTAL, DATAEMISSAO, DATAPREVISAO, CLIENTE, CODCLIENTE, CODETAPA_ATUAL, DATAHORAENTRADA_ULTIMA, DATAHORASAIDA_ULTIMA, IS_REPARO, IS_ECOMMERCE, CPF, TELEFONE, CODEMPRESA }`.

## Fluxo interno
1. Controller exige `dataInicio` e `dataFim`; monta SQL inline com filtros de data e filtro opcional de empresa.
2. `runQuery` executa e retorna as linhas já ordenadas por `dataemissao` descendente.
3. Service `getMonitorProducao` é usado quando preferimos a query do arquivo: carrega `monitor_producao.sql`, executa e aplica filtro de empresa no resultado.

## Tabelas/Views consultadas
- `ordemservicocaixa`, `ordemservicocaixalog`, `usuario`, `pessoa` (empresa/cliente), subselects para etapas; em `queries/os/monitor_producao.sql` há junções adicionais com ordens de compra (`ordemcompra`, `ordemcompra_transacaoitem`) e itens de serviço.

## Consumo no frontend
- Painel de monitoria lê este endpoint para listar OS, etapa atual e informações de contato do cliente. Código frontend em Lovable usa a resposta já normalizada; filtros de datas e empresa são passados via query string.

## Filtros e métricas
- Filtros: data de emissão obrigatória, empresa opcional.
- Métricas/colunas: etapa textual, datas de última entrada/saída, total da OS, cliente/CPF, telefone normalizado, código interno da empresa.
