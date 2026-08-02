# Revisão do Módulo de Vendas + Arquitetura de Metas e Comissões

Data: 2026-07-28 · Escopo: `firebird-bridge` (API) + `tica-diniz-insights` (frontend)
Status: plano em execução — **Fase 0 implementada em 2026-07-28** (bridge + frontend); **Fase 1 (parte bridge) implementada em 2026-07-28**: `recebimentos_detalhe.sql`, `emitidos_por_vendedor.sql`, `devolucoes_restituicao.sql` (hipótese pendente de validação), `recebimentosService`, endpoints `/vendas/recebimentos[/agregado]`, `/vendas/emitidos`, `/vendas/devolucoes-restituicao` e `npm run validar:recebimentos`. Parte Supabase implementada (`recebimentos_agregado_diario` + edge `sync-recebimentos-diario` + cron 07:30 + `sync_log`). **Validação contra o banco real executada em 2026-07-28** via `GET /vendas/recebimentos/validacao` (Firebird 3.0.11, acessível só via Railway): hipótese das devoluções CONFIRMADA (devolução gera crédito tipo 6 ou não tem financeiro; restituição = parcela paga em forma ≠ 6); distribuição 30 dias: tipo 3 cartões R$ 1,07M, tipo 4 BANCO R$ 880k (PENDENTE: Natan classificar — PIX? boleto?), tipo 6 créditos R$ 86,9k, tipo 1 dinheiro R$ 18k; tipos 2 (cheque) e 5 (carnê) sem ocorrência no período. Bug corrigido: placeholder de venda regular em comentário gerava -104. Tipo 4 classificado (boleto→CREDIARIO; PIX via bandeira de cartão→categoria PIX 3%). **Fase 2 implementada em 2026-07-28**: migration (metas_semanais, divisao_semanal, grupos_lojas, comissao_taxas com seeds, premios_config), lib pura de cálculo (src/lib/metas/), services (metasSemanaisService, acompanhamentoSemanalService) e UI (/config/metas: abas Semanas com sugestão ano anterior +10% e grade com ajuste AJUSTADA, Divisão em massa, Grupos, Comissões & Prêmios só-master). Design: apenas metas LOJA materializadas; vendedor/gerente/supervisor derivadas na leitura (ajustes manuais têm precedência). Pendências: aplicar as 2 migrations + deploy da edge sync-recebimentos-diario no Supabase; frescor da cópia era problema de job (resolvido pelo Natan). **Ajustes pós-review (2026-07-28)**: padrão 21→20 virou default do mês comercial (sem depender de metas_periodos); cortes semanais editáveis (`metas_semana_cortes` — sugestão seg→dom, gestor finaliza); tela de metas unificada para 1..N lojas com nº vendedores, dias úteis (calendário clicável) e meta diária visíveis; abas redundantes Metas Lojas/Vendedores removidas. **Fase 3 implementada (2026-07-28)**: página /vendas/acompanhamento por perfil — vendedor (profiles.cod_vendedor) vê só a própria posição; gerente vê a loja; supervisor (profiles.cod_grupo_supervisor) vê o grupo; admin vê tudo — com semáforo pro-rata, detalhamento por origem e faixa de prêmio projetada. Pendências: aplicar migrations `20260729093000` (cortes) e `20260729100000` (escopo profiles) e vincular usuários a vendedor/grupo. Acesso restrito implementado (RLS por perfil em recebimentos; vínculos de usuário na tela Admin→Usuários; trigger impede auto-alteração de vínculo). **Fase 4 implementada (2026-07-28)**: /rh/fechamento-semanal — prévia por loja×semana×modo (RECEBIDO padrão / EMITIDO com taxa da categoria especial EMITIDO), motor puro de comissão testado (taxas por categoria, CREDITOS 0%, restituições abatem base e comissão pela taxa média ponderada, prêmio FAIXA e SEQUENCIA sobre a base), snapshot imutável em fechamentos_comissao(+itens com detalhe por OS), reabertura só admin com log, export XLSX (resumo + detalhe) e edge `rh-fechamentos` (GET com x-api-key = secret RH_API_KEY) para o sistema externo. Pendências operacionais: aplicar migrations 20260729110000 e 20260729120000, deploy da edge rh-fechamentos e configurar o secret RH_API_KEY. Fase 5 pendente (performance residual: reescrever CTEs das queries de auditoria, índices, limite de concorrência do fan-out ALL).

---

## 1. Sumário executivo

O módulo de vendas funciona, mas tem três problemas estruturais que precisam ser resolvidos **antes** de construir metas semanais e comissões em cima dele:

1. **Os números não batem entre telas.** Existem duas definições de faturamento, duas datas de referência (emissão × encerramento), três semânticas diferentes para "excluir créditos" e regras de "venda válida" divergentes entre o Dashboard de Vendas e a Inteligência de Vendas. Qualquer meta calculada hoje herdaria essa ambiguidade.
2. **A meta por vendedor está quebrada na origem.** O frontend grava o código da loja como se fosse o código do vendedor, e a constraint UNIQUE faz os registros se sobrescreverem. Além disso, as metas de vendedor são buscadas mas nunca exibidas.
3. **As queries mais pesadas varrem o banco inteiro** (CTEs sem filtro de data/empresa) e `empresa=ALL` dispara 10 conexões paralelas ao Firebird. O caminho para agilidade não é otimizar essas queries no limite — é **materializar agregados diários** (padrão que já existe: `sync-agregados-diarios` → `vendas_agregado_diario` no Supabase) e fazer os dashboards lerem só do cache.

A boa notícia: a fundação para metas já existe (tabelas `metas_vendas`, `metas_periodos`, `calendario_feriados`, `lojas_configuracao` no Supabase, cron diário no bridge). O plano abaixo corrige as divergências, estende o cache para recebimentos e constrói metas semanais + comissões + fechamento RH por cima.

---

## 2. Regras de negócio definidas (fonte: Natan, 2026-07-28)

**Metas**
- **A meta primária é a da LOJA.** Sugestão automática da meta mensal da loja: **realizado do mesmo mês no ano anterior + 10%**.
- Meta diária = meta mensal ÷ dias úteis do mês (calendário de feriados + configuração da loja).
- Meta semanal da loja = meta diária × dias úteis daquela semana.
- **Meta do vendedor é derivada**: `(meta semanal da loja × % de divisão) ÷ nº de vendedores da semana`. O % de divisão e o nº de vendedores são **ajustáveis por loja e por semana** (entradas/saídas de vendedores), com ferramenta de **ajuste em massa** dos parâmetros.
- Hierarquia de metas: **vendedor** (fração da loja) · **gerente** (total da loja) · **supervisor** (total de um grupo de lojas).
- **Prêmios**: escala percentual sobre o atingimento da meta (faixas configuráveis, ex.: ≥100% → +X%, ≥110% → +Y%) e **premiação extra por sequência** de semanas atingidas dentro do mês. Faixas e valores configuráveis pelo master, nunca no código.
- Meta e comissão são baseadas em **valores recebidos** (data de pagamento), não em OS emitidas. Exceção: o gestor pode escolher, **no momento de gerar o fechamento**, o modo "emitido em OS" (data de emissão).

**Comissões (sobre o valor recebido no período)**
| Categoria | Comissão (vigente hoje) | Observação |
|---|---|---|
| Cartão de crédito | 2% | tipo 3, bandeira com `credito='T'` |
| À vista | 3% | dinheiro (tipo 1), **PIX** (bandeira de cartão com "PIX": PIX/TED, PIX ADDI) e **cartão de débito** |
| Crediário / boleto / carnê | 1% | tipo 4 = **boletos emitidos** + tipo 5 carnê; só a parcela **paga** comissiona |
| Cheque e convênio | 1% | **somam na meta** |
| Créditos (tipo 6) | 0% | **não paga comissão e não soma na meta** |
| Saldo a receber | 0% | nunca comissiona antes do pagamento; a bandeira interna "SALDO A RECEBER" (cod 11) vai para OUTROS |

*Mapeamento de formas validado contra o banco real (Firebird 3.0.11) em 2026-07-28. Distribuição de recebimentos 30 dias (rede): cartões R$ 1,07M · boleto R$ 52,9k · créditos R$ 43,4k · dinheiro R$ 18k. Recebimentos filtram `fl.pagar = 'F'` (só contas a receber — contas pagas de fornecedor via banco distorciam a primeira leitura).*

**Devoluções — regra dupla:**
- Devolução **com geração de crédito** para o cliente: não abate meta nem comissão (o crédito voltará como pagamento de compra futura — e crédito nunca conta, fechando o ciclo sem dupla contagem).
- Devolução **com restituição de valores** ao cliente (sem gerar crédito): **abate meta e comissão** do vendedor na semana da restituição.

**Garantia não é venda.** Excluída de todo racional de vendas, metas e comissões (mesma regra do CRM: `NOT EXISTS vendagarantia_item`). Futuramente, um dashboard exclusivo de garantias.

> **Os percentuais NUNCA são chumbados no código.** Ficam na tabela `comissao_taxas`, **editável apenas pelo perfil master** no painel de configuração — sem controle de vigência: vale a taxa definida pelo master no momento do fechamento. O snapshot do fechamento grava o % aplicado, então mudanças posteriores não alteram fechamentos já realizados.

**Composição do realizado (meta atingida) do vendedor na semana:**

```
realizado_semana = recebido de vendas da própria semana (entrada/parcelas pagas)
                 + recebimentos de saldo de vendas ANTERIORES pagos nesta semana
```

O saldo a receber (não pago) nunca entra. A soma vale para meta e comissão, mas o **relatório do vendedor obriga o detalhamento por origem**: cada linha identifica a OS/venda e se o valor é `VENDA_PERIODO` (venda emitida na semana) ou `SALDO_ANTERIOR` (parcela de venda emitida antes da semana).

**Datas**: OS cadastradas → `dataemissao`; pagamentos → `datapagamento` da parcela (`FINLANCAMENTOPARCELA`), usando `valorpago` (nunca o previsto `valor`).

**Relatório RH**: tela no sistema com export (XLSX/PDF) **+ API de integração** — os valores serão consumidos por outro sistema em breve, então o fechamento precisa ser persistido e exposto via endpoint.

---

## 3. Divergências encontradas (corrigir antes de metas)

### 3.1 Backend (firebird-bridge)

| # | Problema | Onde | Impacto |
|---|---|---|---|
| D1 | Duas definições de faturamento: `SUM(TOTAL - VALORDESCONTO - TOTALIPI)` vs `SUM(TOTAL - TOTALIPI)` | `resumo_empresa_vendedor.sql`, `analise_*.sql` (com desconto) × `resumo_diario_simples.sql`, `formas_pagamento_*.sql` (sem) | Telas do mesmo período mostram valores diferentes |
| D2 | Datas conflitantes **dentro da mesma query**: CTE `itens` filtra `DATAENCERRAMENTO`, CTE `creditos` filtra `DATAEMISSAO` | `resumo_empresa_vendedor.sql` | `TOTAL_VENDIDO_SEM_CREDITOS` subtrai conjuntos diferentes |
| D3 | `dataemissao` × `dataencerramento` variam por endpoint | encerramento: resumo-empresa-vendedor, análises; emissão: diário, formas de pagamento | Mesma pergunta, respostas diferentes |
| D4 | `excluirCreditos=1` tem 3 semânticas: descarta a venda inteira / remove só a linha / redistribui o valor no rateio | `resumo_empresa_vendedor` / `formas_pagamento_resumo` / `resumo_diario_simples` | Créditos ora somem, ora inflam dinheiro/cartão |
| D5 | **Nenhuma query de vendas exclui garantia** (`vendagarantia_item`), apesar da regra "garantia não é venda" (CLAUDE.md) | todas em `queries/vendas/` | Faturamento superestimado; só o CRM filtra |
| D6 | Blocos CONVENIO/DEVOLUCAO sem `nat.tipo = 1` e com produto cartesiano parcela × item (multiplica totais) | `resumo_diario_simples.sql`, `formas_pagamento_resumo.sql` | Valores inflados nesses blocos |
| D7 | Devolução ignora `excluirCreditos` | `formas_pagamento_resumo.sql` | Inconsistência no toggle |
| D8 | Auditoria mistura colunas rateadas e não rateadas; somar as não rateadas duplica vendas multi-forma | `formas_pagamento_auditoria.sql` | Auditoria induz erro |
| D9 | `IIF(datapagamento IS NULL, valor, valorpago)` mistura previsto e realizado na mesma soma | todas as queries de formas de pagamento | **Crítico para comissão**: hoje não dá para separar recebido de a receber |
| D10 | PIX não mapeado (cai em OUTROS); rótulos de forma divergem entre vendas e financeiro; mapeamento hardcoded em 5 arquivos | queries de vendas + `financeiro_parcelas.sql` | Comissão por categoria exige mapeamento único |
| D11 | `vendasAnaliseService.js` órfão com parâmetros na ordem errada; `financeiro_resumo_por_empresa.sql` com erro de sintaxe; `financeiro_dre.sql` não carregada | `src/services/`, `queries/financeiro/` | Código morto/quebrado |
| D12 | `useFinanceiroDashboard.ts` lê chaves MAIÚSCULAS e situação `'ABERTA'`; a SQL devolve minúsculas e `'EM ABERTO'` | bridge (frontend embutido) | Dashboard financeiro embutido quebrado |
| D13 | Falha parcial de empresa vira `[]` silencioso com HTTP 200; erros achatados em `INTERNAL_ERROR` | `vendasService.js`, `apiResponse.js` | Dashboard pode subestimar faturamento sem aviso |
| D14 | `GET /vendas/resumo-empresa-vendedor/debug?action=create-indexes` executa **DDL em produção sem autenticação** (CORS `*`, sem auth em nada) | `vendasController.js` | Segurança |

### 3.2 Frontend (tica-diniz-insights)

| # | Problema | Onde | Impacto |
|---|---|---|---|
| F1 | Meta por vendedor grava `codVendedor = código da loja`; UNIQUE(tipo, cod_referencia, ano, mes) colapsa todos os vendedores da loja num registro só | `useMetasVendas.ts:76-84` | **Metas de vendedor nunca funcionaram** |
| F2 | `metasVendedores` é buscado e nunca usado; ranking de vendedores não mostra meta | `useInteligenciaVendas.ts` | Feature fantasma |
| F3 | "Venda válida" divergente: Dashboard trata `CREDITOS/CREDITO` (upper+trim); Inteligência compara `=== 'CREDITO'` exato → **conta créditos como venda** | `useVendasDashboard.ts` × `useInteligenciaVendas.ts` | % de meta calculado sobre base errada |
| F4 | Ticket médio com 3 fórmulas diferentes em 3 hooks | idem + `useComparativoAnual.ts` | KPIs divergem |
| F5 | Botão "Atualizar" apaga o período no cache e regrava tudo **com uma única data** — destrói a granularidade diária que a aba Por Dia, o Comparativo e a Inteligência dependem | `useVendasDashboard.ts:372-424` (`salvarNoCache`) | **Corrupção de dados do cache** |
| F6 | Seletor de ano dessincronizado: salva num ano, filtra noutro → tabela "vazia" | `MetasConfigDashboard.tsx` | UX de metas quebrada |
| F7 | Meta casada por mês-calendário, mas período comercial pode ser 21→20 (`metas_periodos`) | `useInteligenciaVendas.ts` | Meta e realizado em janelas diferentes |
| F8 | 24 queries Supabase por render na tela de metas; dropdown de vendedores carrega 3 meses de vendas de todas as lojas | `useMetasVendas.ts` | Lentidão desnecessária |
| F9 | Multi-loja manda `ALL` ao bridge e filtra no cliente; grava o dataset não filtrado no cache | `firebirdBridge.ts` + `useVendasDashboard.ts` | Agrava F5 e desperdiça as 10 conexões |
| F10 | `percentual_aceitavel` e `meta_ticket_medio` gravados e nunca lidos | metas | Config sem efeito |

### 3.3 Redundâncias e código morto

- **Gráfico + tabela duplicados com a mesma métrica**: StoreChart/StoreTable, SellerChart/SalesTable, PaymentMethodsChart/PaymentMethodsTable, ComparativoPanel (gráfico + chips + tabela). Recomendação: par vira **toggle** (visão gráfico ↔ tabela), não os dois empilhados — dashboard mais curto e de leitura diária mais rápida.
- `DescontoChart` repete % desconto que já está em coluna da SalesTable e em KPI.
- Código morto a remover: `auditoriaService.ts`, `useResumoVendas.ts`, `useResumoFormasPagamento.ts`, `ComparativoAnualChart.tsx`, `ComparativoMensalChart.tsx`, `SalesAlerts.tsx`, `useComparativoMensal.ts`, `components/metas/{MetaForm,MetasFilters,MetasTable}.tsx`; no bridge: `vendasAnaliseService.js`, `vendasAnaliseController.js`, `src/services/debug_create_indexes.sql`. (`queries/os/monitor.sql` foi verificado na Fase 0: **não** é duplicata morta — é carregado por `osService.js`; mantido.)
- Edge functions `sync-agregados-semanal` e `sync-agregados-mensal` existem e não são chamadas — avaliar reaproveitar (semanal serve direto ao módulo de metas) ou apagar.

---

## 4. Performance e timeouts

**Causas identificadas, por gravidade:**

1. `formas_pagamento_resumo.sql` e auditorias: CTEs `itens_por_transacao` / `pagamentos_por_transacao` agregam **toda** a `TRANSACAO_ITEM` e **toda** a cadeia financeira do banco, sem filtro de data/empresa. É a query que motivou o timeout de 45s e o cache stale. Correção: empurrar o filtro de data/empresa para **dentro** das CTEs.
2. `analise_sku.sql`: `tbUltimaVenda`/`tbUltimoCusto` varrem o histórico inteiro.
3. Padrão `JOIN P ON 1=1` + `WHERE data BETWEEN P.P_DATA_INI AND P.P_DATA_FIM`: o predicado compara contra colunas de CTE e o Firebird tende a não usar índice de data. Trocar por parâmetros diretos no WHERE.
4. `empresa=ALL` = 10 queries paralelas, cada uma com `attach/detach` próprio, sem limite de concorrência. Adicionar pool/limite (ex.: 3 simultâneas).
5. Índices propostos em `debug_create_indexes.sql` usam `DATAENCERRAMENTO`, mas as queries pesadas filtram `DATAEMISSAO`. Rever após padronizar a data (D3).
6. Funções sobre colunas (`UPPER(TRIM(...))`, `SIMILAR TO`, concatenações no `COUNT(DISTINCT a || '-' || b)`) impedem índice — mover classificações para o pós-processamento JS ou para o agregado materializado.

**Estratégia estrutural (a recomendação central): cache diário materializado como fonte primária.**

O padrão já existe e funciona (`syncEstoqueService` no cron 07:00; `sync-agregados-diarios` → `vendas_agregado_diario`). Evoluir para:

- Dashboards e metas **leem exclusivamente do Supabase** (agregados diários). O Firebird só é consultado: (a) pelo sync diário automático; (b) em drill-down/auditoria explícita, com filtros obrigatórios e paginação.
- Sync diário passa a cobrir também **recebimentos** (ver §5) e a gravar `sync_log` (última execução, linhas, erros) exibido no frontend ("dados de DD/MM HH:mm").
- O botão "Atualizar" do dashboard passa a **disparar o sync incremental do dia corrente** (re-agrega só hoje/ontem) em vez de reescrever o período inteiro — elimina F5 por construção.
- Consequência: timeout do Firebird deixa de afetar o usuário; afeta só o job, que tem retry.

---

## 5. Arquitetura de metas semanais e comissões

### 5.1 Dados novos no bridge (Firebird → leitura)

**`queries/vendas/recebimentos_detalhe.sql`** (novo) — a peça que falta hoje:

- Base: `FINLANCAMENTOPARCELA` com `datapagamento BETWEEN ? AND ?` e `valorpago` (nunca `valor`), cadeia `parcela → finlancamento → finfaturatransacao → transacao → saida.cod_vendedor`.
- Colunas: `cod_empresa, cod_vendedor, vendedor_nome, data_pagamento, forma_categoria, valor_recebido, cod_transacao, dataemissao`.
- `origem` derivada por comparação `dataemissao` × período consultado: `VENDA_PERIODO` (emitida dentro da semana) ou `SALDO_ANTERIOR` (emitida antes) — obrigatória no detalhamento por vendedor.
- `forma_categoria` normalizada em **um único lugar** (resolve D10): `CARTAO_CREDITO`, `CARTAO_DEBITO`, `AVISTA` (dinheiro/PIX), `CREDIARIO` (carnê/boleto/banco), `CHEQUE`, `CREDITOS`, `OUTROS`. Mapeamento tipo 6 = CREDITOS **sempre excluído** de meta e comissão.
- Exclui garantia (`NOT EXISTS vendagarantia_item`) — mesma regra do CRM (resolve D5 para o mundo de metas).
- Endpoint: `GET /api/v1/vendas/recebimentos?empresa=&dataIni=&dataFim=` (registrar em `index.js` **e** `src/routes/index.js`).
- Papel duplo: alimenta o agregado diário (dashboards) e é consultada **no ato do fechamento** para montar o detalhe por OS/venda que vai congelado no snapshot — o agregado sozinho não guarda `cod_transacao`.

**`queries/vendas/emitidos_por_vendedor.sql`** (novo) — para o modo alternativo "emitido em OS": mesmo shape, filtrando `transacao.dataemissao`, valores da venda (não da parcela).

**`queries/vendas/devolucoes_restituicao.sql`** (novo) — devoluções da semana **com restituição de valores** (sem geração de crédito), por vendedor, para abatimento de meta e comissão. ⚠️ Item de verificação da Fase 1: identificar no schema como distinguir devolução que gera crédito de devolução com restituição (provável via lançamento financeiro associado a `entradanotafiscaldevolucao` — confirmar com `npm run validar` contra casos reais).

### 5.2 Dados novos no Supabase

| Tabela | Chave | Conteúdo |
|---|---|---|
| `recebimentos_agregado_diario` | (cod_empresa, cod_vendedor, data_pagamento, forma_categoria, origem) | `valor_recebido`, `qtd_parcelas` — `origem` = VENDA_PERIODO\|SALDO_ANTERIOR (relativa à semana comercial da data de pagamento); alimentada por edge `sync-recebimentos-diario` (cron, junto do sync existente) |
| `comissao_taxas` | (forma_categoria) | `percentual` — configuração simples, editável só pelo master; nada de percentual no código |
| `metas_semanais` | (tipo, cod_referencia, ano, semana_inicio) | `tipo` = LOJA\|VENDEDOR\|GERENTE\|SUPERVISOR; `meta_valor`, `dias_uteis`, `origem` ('AUTO'\|'AJUSTADA'). LOJA gerada da meta mensal; VENDEDOR derivada da loja (ver `divisao_semanal`); GERENTE espelha o total da loja; SUPERVISOR soma o grupo |
| `divisao_semanal` | (cod_empresa, semana_inicio) | `percentual_divisao` (fração da meta da loja distribuída aos vendedores), `num_vendedores` — ajustável semana a semana, com edição em massa |
| `grupos_lojas` | (cod_grupo) + membros | grupos de lojas para metas/visão de supervisor |
| `premios_config` | (faixa) | faixas de atingimento (% meta → % prêmio) + regra de premiação extra por sequência de semanas atingidas no mês; editável pelo master |
| `fechamentos_comissao` | (cod_empresa, semana_inicio) + itens por vendedor | snapshot **imutável** do fechamento: modo (RECEBIDO/EMITIDO), base por categoria, % aplicado, comissão, status (RASCUNHO/FECHADO). É o que a API de integração expõe |

`metas_vendas` (mensal) permanece como está, **corrigindo** `cod_referencia` do vendedor para o `COD_VENDEDOR` real — o SQL `resumo_empresa_vendedor.sql` já expõe essa coluna; basta o service/hook do frontend propagá-la (corrige F1).

### 5.3 Fluxo de cálculo

1. **Sugestão de meta mensal da loja** (na tela de config): `realizado do mesmo mês do ano anterior × 1,10`. Realizado vem de `recebimentos_agregado_diario` (quando houver histórico) ou de `vendas_agregado_diario` como fallback no primeiro ano. Sempre editável antes de salvar.
2. **Geração das semanas da loja**: ao salvar a meta mensal, uma função (edge ou trigger) gera as linhas LOJA de `metas_semanais`: meta diária = meta mensal ÷ dias úteis do mês (usa `calendario_feriados` + `lojas_configuracao` + `lojas_excecoes`, respeitando o período comercial 21→20 de `metas_periodos` — resolve F7); meta da semana = meta diária × dias úteis da semana. Semanas que cruzam o mês são rateadas pelos dias úteis de cada mês.
3. **Derivação por vendedor**: `meta_vendedor(semana) = meta_loja(semana) × percentual_divisao ÷ num_vendedores`, com parâmetros de `divisao_semanal`. Alterar o divisor de uma semana regenera só as linhas VENDEDOR daquela semana (as AJUSTADAS manualmente são preservadas com aviso). GERENTE = meta da loja; SUPERVISOR = soma das lojas do grupo.
4. **Realizado semanal**: `SUM(valor_recebido)` de `recebimentos_agregado_diario` na semana, `forma_categoria <> 'CREDITOS'` — soma das duas origens (VENDA_PERIODO + SALDO_ANTERIOR), **menos devoluções com restituição em dinheiro** da semana; detalhamento por origem e por OS/venda no drill-down do vendedor.
5. **Comissão**: no fechamento, por vendedor: `Σ (valor_recebido × taxa(forma_categoria))` no modo RECEBIDO, ou sobre os emitidos no modo EMITIDO (escolha do gestor por fechamento), abatendo comissão de restituições em dinheiro. Taxas sempre lidas de `comissao_taxas` (definidas pelo master); o snapshot do fechamento grava o % efetivamente aplicado.
6. **Prêmios**: calculados no fechamento a partir de `premios_config`: faixa atingida pelo % da meta semanal + verificação da sequência de semanas atingidas no mês para a premiação extra. Entram como linhas separadas no fechamento (comissão × prêmio discriminados).

### 5.4 Telas

1. **Config de metas** (refatorar `/config/metas`, quebrando o monolito de 1.655 linhas): corrigir F1/F6/F8; botão "Sugerir metas (ano anterior +10%)" por loja; grade de semanas geradas com ajuste fino (origem vira 'AJUSTADA'); painel de **divisão semanal** (% da meta da loja + nº de vendedores por semana, com edição em massa por período/grupo de lojas); configuração de grupos de lojas (supervisores), taxas de comissão e faixas de prêmio (master).
2. **Acompanhamento — hierarquia de perfis** (evoluir `/vendas/inteligencia`, escopo via `pageCatalog.ts`):
   - **Vendedor**: vê **só a própria meta e posição** (sem ranking completo da loja, por enquanto): meta da semana, recebido, % atingido, ritmo/dia restante, prêmio projetado.
   - **Gerente**: sua loja inteira — meta da loja + todos os vendedores dela, semáforo, sequências de atingimento.
   - **Supervisor**: grupo de lojas (`grupos_lojas`) — consolidado por loja + drill-down.
   - Corrigir F2/F3 para que o % use a mesma regra de venda válida do dashboard.
3. **Fechamento RH** (`/rh/fechamento-semanal`, nova): seleciona semana + modo (recebido/emitido) → prévia por vendedor com **duas camadas**: (a) resumo — base por categoria de pagamento × origem (venda do período / saldo anterior), abatimento de restituições, taxa configurada, comissão, prêmios; (b) detalhe expandível — linha a linha por OS/venda: número da OS, data de emissão, forma, valor recebido, origem, comissão da linha. Botão "Fechar semana" persiste snapshot em `fechamentos_comissao` (resumo + detalhe) → export XLSX/PDF. Fechado é imutável; reabertura só com permissão de admin e log.

### 5.5 API de integração (RH / sistema externo)

- `GET /api/v1/comissoes/fechamentos?semana=YYYY-MM-DD&empresa=` — lê `fechamentos_comissao` (Supabase), nunca o Firebird. JSON estável e versionado; é o contrato que o outro sistema vai consumir.
- Autenticação por API key (aproveitar para introduzir auth também nos endpoints de debug — resolve D14).

---

## 6. Plano de implementação (fases para Claude Code/dispatch)

**Fase 0 — Fundação e correções (pré-requisito de tudo)**
- Padronizar faturamento: `TOTAL - VALORDESCONTO - TOTALIPI` e data única por contexto (emissão para venda; pagamento para recebimento) em todas as queries de vendas (D1–D4).
- Excluir garantia (`NOT EXISTS vendagarantia_item`) de **todas** as queries de vendas (D5) — decisão confirmada: garantia não é venda.
- Unificar mapeamento de formas de pagamento num só lugar, incluir PIX (D10).
- Corrigir F1 (COD_VENDEDOR real fim a fim), F3 (normalizar `CREDITOS`), F5 (parar de reescrever o cache com data única), F6, D12.
- Remover código morto (§3.3); proteger/remover endpoint DDL (D14); erros parciais passam a retornar aviso no `meta` da resposta (D13).
- Critério de aceite: mesmos período/loja retornam o mesmo total em todas as telas.

**Fase 1 — Dados de recebimento**
- `recebimentos_detalhe.sql` + `emitidos_por_vendedor.sql`, service, controller, rotas (nos dois entrypoints), testes.
- Edge `sync-recebimentos-diario` + tabela `recebimentos_agregado_diario` + `sync_log`; incluir no cron.
- Critério: soma dos recebimentos do dia bate com auditoria manual no ERP para 2 lojas de amostra (`npm run validar` estilo CRM).

**Fase 2 — Metas semanais**
- Tabelas `metas_semanais`, `divisao_semanal`, `grupos_lojas`, `comissao_taxas`, `premios_config`; geração automática LOJA → derivação VENDEDOR/GERENTE/SUPERVISOR; sugestão ano anterior +10%; refatoração da tela de config com edição em massa.
- Inclui `devolucoes_restituicao.sql` (Fase 1) integrada ao realizado.
- Critério: salvar meta mensal gera semanas cujos valores somam a meta do mês; alterar divisor de uma semana regenera só aquela semana; feriados e período 21→20 respeitados.

**Fase 3 — Acompanhamento interativo**
- Inteligência de Vendas com visão semanal (gestor) + escopo colaborador; consolidação dos pares gráfico/tabela em toggles.
- Critério: % de meta idêntico ao KPI "Vendas Válidas" do dashboard para o mesmo recorte.

**Fase 4 — Fechamento RH + integração**
- Tela `/rh/fechamento-semanal`, snapshot `fechamentos_comissao`, export XLSX/PDF, endpoint de integração com API key.
- Critério: fechamento reprocessado dá o mesmo resultado (imutabilidade); export confere com a tela.

**Fase 5 — Performance residual**
- Reescrever CTEs sem filtro das queries de formas de pagamento/auditoria (que viram só drill-down), índices alinhados à data padronizada, limite de concorrência no fan-out `ALL`, React Query com staleTime no frontend.

---

## 7. Decisões tomadas (Natan, 2026-07-28)

1. **Cartão de débito** = à vista (3%).
2. **Cheque e convênio**: comissionam a 1% e somam na meta.
3. **Devolução**: com geração de crédito → não abate nada (o crédito não conta em nenhuma ponta); com restituição de valores → abate meta e comissão.
4. **Garantia não é venda** — fora de todo racional de vendas/metas/comissões, incluindo os dashboards atuais (Fase 0). Futuro: dashboard exclusivo de garantias.
5. **Meta do vendedor deriva da meta da loja**: `(meta loja × % de divisão) ÷ nº de vendedores`, com % e divisor ajustáveis por semana e edição em massa. Prêmios escaláveis por faixa de atingimento + premiação extra por sequência no mês.
6. **Vendedor vê só a própria posição.** Gerente vê a loja toda; supervisor vê um grupo de lojas. Metas configuráveis nos três níveis.

**Pendência técnica (Fase 1):** confirmar no schema Firebird como distinguir devolução com geração de crédito × com restituição em dinheiro (§5.1).

---

## 8. Aferição dashboard × base de comissões (2026-08-02)

Conciliação em produção — loja 1, junho comercial (21/05–20/06):

| Fonte | Valor | Observação |
|---|---|---|
| Dashboard (`vendas_agregado_diario` ← `resumo_diario_simples.TOTAL_VENDIDO`, itens) | 104.460,15 | = `/vendas/emitidos` exato; **correto** |
| — sem créditos | 99.112,15 | créditos rateados por item: 5.348,00 |
| Base de comissão ligada às mesmas vendas (antes do fix) | 110.646,87 | inflada |
| Base de comissão (após fix) | **99.294,87** | = 99.112,15 + 182,71 de juros de parcelamento ✔ |

**Bug encontrado e corrigido — fatura compartilhada:** venda com N transações
(mesmo `numerotransacao`) ligadas à MESMA `finfaturatransacao` recebia as
parcelas integrais em CADA transação (ex.: 5 vendas na loja 1/junho, R$ 12,7
mil duplicados; R$ 11.352 na base sem créditos). Fix: dedup no
`recebimentosService` (`dedupeFaturaCompartilhada` via coluna `cod_fatura`;
parcela conta 1× na transação canônica, `os_list` = união das OS da fatura).
A subquery canônica em SQL foi testada e **estoura timeout** (sem índice em
`transacao.cod_faturatransacao`) — por isso a regra vive no service.

**Diferenças por desenho (não são bugs):**
- Dashboard é EMISSÃO (valor da venda por itens); comissão é REGIME (cartões na
  emissão; demais formas no pagamento) — parcelas pagas após o período caem no
  mês seguinte da comissão, e saldos de meses anteriores pagos entram só na comissão.
- Juros/acréscimo de parcelamento (pago > emitido) entram na base de comissão e
  não no dashboard (R$ 182,71 no recorte aferido). Decisão de negócio: manter.
- PIX: no dashboard aparece como CARTAO DEBITO (bandeira `credito='F'`); na
  comissão é categoria própria PIX. Mesmos valores.
- `formas_pagamento_resumo.TOTALGERAL` mantém a duplicação (documentada no SQL);
  não usar como faturamento oficial.

**Pós-fix:** re-sincronizar o histórico de `recebimentos_agregado_diario`
(backfill via edge, como nas vezes anteriores) — o cache Supabase anterior ao
fix carrega os valores duplicados. Fechamentos congelados antes do fix mantêm
os números da época (reabrir e refechar se necessário).
