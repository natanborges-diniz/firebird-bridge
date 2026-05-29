# CLAUDE.md — firebird-bridge

Guia de contexto e regras de trabalho para agentes (Claude Code, dispatch) e
para espelhar nas instruções de um Project no Claude.ai. **Este é o documento
mestre** — mantenha uma única versão e atualize-a aqui.

## O que é o projeto

API HTTP (Express) hospedada no **Railway** que executa SQLs pré-definidos em um
banco **Firebird** (ERP/Dataweb das Óticas Diniz). O frontend consome só a API
pública. A bridge **não** contém lógica de negócio pesada: carrega `.sql` e
devolve JSON.

- Deploy: **Railway**, faz deploy automático da branch **`main`**.
- Produção: `https://firebird-bridge-production.up.railway.app/api/v1`

## Como rodar localmente

- Node **20** (ver `.nvmrc`). `npm install`.
- Criar `.env` a partir de `.env.example` e preencher `FIREBIRD_*`
  (HOST, PORT, DATABASE, USER, PASSWORD, CHARSET).
- `npm start` sobe a API (porta 3000 por padrão).
- `npm test` roda os testes (Jest, `--runInBand`).
- Validar o CRM contra o banco real: `npm run validar:crm <empresa>`.

> Obs.: a suíte `__tests__/hubReceitas.test.js` tem falhas **pré-existentes**,
> não relacionadas a mudanças novas. As demais devem passar.

## Estrutura e convenções

- SQLs ficam em `queries/<modulo>/*.sql` e são carregados pelos
  `src/services/<modulo>Service.js` (via `fs.readFileSync` + `db.query`).
- Controllers em `src/controllers`, rotas em `src/routes`.
- **Atenção ao registrar rota nova**: precisa entrar em **dois** lugares —
  `index.js` (entrypoint do `npm start`) **e** `src/routes/index.js` (usado pelos
  testes via `src/server.js`).
- Resposta padrão sempre: `{ ok, data, error }` (ver `docs/API_CONTRATO.md`).
- Parâmetro de empresa: `empresa` (ou `codEmpresa`); `ALL`/vazio = todas.

### Padrão importante: checagem de schema em runtime

Para resistir a variações de schema do Firebird, os services checam a existência
de colunas/tabelas via `rdb$relation_fields` (helper `hasColumn`) e **podam o
que não existe**, com fallback gracioso. Use esse padrão ao tocar em colunas
incertas (ex.: `src/services/osService.js`, `src/services/crmService.js`).

## Domínio Firebird (fatos verificados)

- `pessoa` = clientes/empresas. Colunas verificadas: `cod_pessoa`, `nome`,
  `cpf`, `telefonecelular`, `telefoneresidencial1`, `telefonecomercial1`.
- `ordemservicocaixa` (OS): `cod_cliente`, `cod_empresaorigem`,
  `cod_ordemservicocaixa`, `dataemissao`. Etapas (`cod_etapa`) descrevem só o
  fluxo logístico (08 = entregue) — **não** indicam reparo.
- **OS de garantia/reparo NÃO são venda**: identificadas por terem linha em
  `vendagarantia_item` (ligação por `cod_ordemservicocaixa`). Para "só vendas
  regulares", excluir com `NOT EXISTS` contra essa tabela.

## Módulo CRM (já implementado)

`GET /api/v1/crm/base?empresa=<n>` — base de clientes para entrega.

- Filtra por empresa (`cod_empresaorigem`); exclui garantia/reparo.
- Colunas opcionais de endereço/contato são detectadas em runtime e podadas se
  não existirem (`crmService`).
- Limpeza: `TRIM`/`NULLIF` nos textos; telefones sanitizados (só 8–15 dígitos);
  e-mail só se tiver formato mínimo `x@y.z`.
- **Dedup por CPF** feito no service (mantém maior `cod_cliente`; sem CPF é
  preservado).
- Arquivos: `queries/crm/base_clientes_entrega.sql`, `src/services/crmService.js`,
  `src/controllers/crmController.js`, `src/routes/crmRoutes.js`,
  `__tests__/crmBase.test.js`.

`GET /api/v1/crm/entregas?empresa=<n>&dataIni=YYYY-MM-DD&dataFim=YYYY-MM-DD` — clientes com OS entregue (etapa 08) no intervalo.

- `data_entrega` = `CAST(ordemservicocaixalog.datahoraentrada AS DATE)` onde `cod_etapa = 8`.
- Retorna um registro por `(cod_cliente, data_entrega)` — dedup por CPF aplicado.
- Inclui `data_nascimento` se `PESSOA.DATANASCIMENTO` existir no schema (runtime).
- Arquivos: `queries/crm/entregas_por_data.sql`, serviço `getEntregasPorData`.

`GET /api/v1/crm/aniversariantes?empresa=<n>[&data=YYYY-MM-DD]` — clientes aniversariantes.

- Compara `MONTH + DAY` de `PESSOA.DATANASCIMENTO` com a data alvo (default: hoje).
- Requer que `DATANASCIMENTO` exista no schema; retorna vazio se não existir.
- Arquivos: `queries/crm/aniversariantes.sql`, serviço `getAniversariantes`.

## Fluxo de trabalho com Git (regra da casa)

Objetivo: evitar desencontros entre os caminhos (dispatch na nuvem, Claude Code
local). **`main` é a fonte única da verdade** (Railway faz deploy dela).

1. **Início de toda sessão**: `git pull --rebase origin main`.
2. Commits **pequenos e frequentes**, mensagens estilo conventional
   (`feat(...)`, `fix(...)`, `refactor(...)`).
3. **Fim de toda sessão**: `git push origin main` (ou abrir/mesclar a branch).
4. Feature branch é bem-vinda, mas **mescle na `main`** ao concluir — senão não
   vai pro Railway.
5. **Um escritor por mudança**: não edite o mesmo código por dois caminhos ao
   mesmo tempo (dispatch e local). Escolha um.

## Divisão de ferramentas

- **Código/repo deste projeto** → dispatch (nuvem, hands-off) ou Claude Code
  (local, interativo). Ambos cuidam do git sozinhos.
- **Fora de código** (documento, planilha, web, apps do computador, pesquisa)
  → Cowork.
- Em ferramenta de thread único (dispatch): trabalhe **sequencial**; agrupe o que
  é relacionado, comece sessão nova para assunto desconexo (mais enxuto/barato).
