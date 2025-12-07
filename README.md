# Firebird Bridge

Bridge HTTP → Firebird para expor consultas consolidadas via Express.

## Configuração
1. Crie um arquivo `.env` (opcional em produção) com:
   ```env
   FIREBIRD_HOST=192.168.0.1
   FIREBIRD_PORT=3050 # opcional; usa 3050 por padrão
   FIREBIRD_DATABASE=/caminho/do/banco.FDB
   FIREBIRD_USER=SYSDBA
   FIREBIRD_PASSWORD=masterkey
   PORT=3000
   ```
   - Para bancos Windows, use o caminho com barras invertidas (ex.: `E:\\FTPBackup\\Integracao\\SPSOASCO.DATAWEB.CERT`).
   - Se o serviço Firebird estiver em porta customizada (ex.: `3058`), defina `FIREBIRD_PORT` para montar a string `HOST/PORT:CAMINHO`.
2. Instale dependências e execute:
   ```bash
npm install
npm start
```

> **Node suportado**: use Node 20.11.x (recomendado) ou 18.x. O driver nativo do Firebird não compila em versões mais novas (ex.: Node 22). Há um arquivo `.nvmrc` com a versão sugerida; basta rodar `nvm use` antes do `npm install`.

### Aplicando patches com `git apply` (método “copiar e colar”)
Se receber um patch por texto (por exemplo, em uma conversa no chat), siga estes passos para aplicá-lo localmente:

1. **Copie o patch** incluindo as linhas que começam com `*** Begin Patch` e `*** End Patch` (ou `diff --git`, dependendo do formato).
2. No terminal, execute:
   ```bash
   git apply <<'PATCH'
   (cole aqui o patch copiado)
   PATCH
   ```
   O redirecionamento `<<'PATCH'` inicia um *here-doc*; digite `PATCH` em maiúsculas na última linha para finalizar.
3. Verifique os arquivos alterados com `git status` e confirme que o patch foi aplicado corretamente.
4. Faça o commit normalmente (`git commit -am "mensagem"`) e envie ao remoto (`git push`).

Se o patch não aplicar limpo, o Git mostrará as linhas com conflito; edite os arquivos indicados para resolver e repita o `git apply` ou ajuste manualmente.

## Endpoints
- `GET /health?checkDb=true` – status da API e, opcionalmente, ping ao Firebird.
- `GET /api/v1/empresas` – lista empresas para filtros.
- `GET /api/v1/financeiro/parcelas` – requer `dataIni`, `dataFim`, `empresa`.
- `GET /api/v1/financeiro/dre` – requer `dataIni`, `dataFim`, `empresa`.
- Demais rotas seguem o prefixo `/api/v1/<domínio>` conforme `src/routes`.

## Testes
```bash
npm test
```

## Como abrir um Pull Request no GitHub

1. Publique o branch local (ex.: `work`) para o remoto que aponta para o seu repositório, normalmente `origin`:

   ```bash
   git push origin work
   ```

2. No GitHub, clique em **Compare & pull request** que aparecerá ao lado do branch recém enviado ou abra manualmente a página `https://github.com/<seu-usuario>/<seu-repo>/compare/work`.

3. Preencha o título e a descrição do PR conforme o resumo das alterações deste branch. Inclua passos de teste executados.

4. Finalize clicando em **Create pull request**. Se houver checks automáticos, acompanhe-os e ajuste o código se necessário.

## Como aplicar as alterações direto na sua `main` sem PR
Se preferir atualizar o repositório sem abrir Pull Request, siga estes passos no seu ambiente local (presumindo que as alterações estejam no branch `work`):

1. Garanta que o remoto correto está configurado (ex.: `origin` aponta para seu GitHub) e atualize as referências:

   ```bash
   git remote -v
   git fetch origin
   ```

2. Troque para o branch de destino (por exemplo, `main`) e leve-o para o estado mais recente do remoto:

   ```bash
   git checkout main
   git pull origin main
   ```

3. Traga o conteúdo do branch `work` para `main`. Você pode usar `merge` (preserva histórico) ou `cherry-pick` (traz commits específicos). O mais simples é:

   ```bash
   git merge origin/work
   ```

   Caso queira apenas o último commit específico, use `git log --oneline origin/work` para ver o hash e depois:

   ```bash
   git cherry-pick <hash_do_commit>
   ```

4. Envie o branch atualizado ao remoto:

   ```bash
   git push origin main
   ```

5. Se houver pipeline de deploy configurado, ele será disparado automaticamente após o push. Caso contrário, siga seu processo de publicação habitual.

> Dica: mantenha `work` atualizado com `git pull` antes de mesclar, para garantir que você está levando a versão mais recente.

## Detalhamento para o Lovable (frontend)
Use este passo a passo para implementar os dashboards no Lovable, seguindo o padrão já usado no Financeiro:

1. **Aproveite o hook existente**: o arquivo `src/hooks/useFinanceiroDashboard.ts` (no front) já consulta `/api/v1/financeiro/parcelas`, calcula métricas e expõe `filters`, `setFilters`, `loading`, `error`, `metrics`, `dailyFlow`, `parcelas` e `reload`.
2. **Layout pronto para o Financeiro**: o componente `src/components/financeiro/FinanceiroDashboardLayout.tsx` recebe exatamente essas props e renderiza filtros, cards, tabela de fluxo diário e tabela de parcelas com skeleton e banner de erro. A página `src/pages/FinanceiroDashboard.tsx` apenas conecta o hook ao layout.
3. **Replicar para outros domínios**:
   - Crie um hook por domínio (ex.: `useVendasDashboard`, `useEstoqueDashboard`, `useOsDashboard`) que chame os endpoints existentes em `/api/v1/<dominio>/...` conforme o `ARCHITECTURE_GUIDE.md`.
   - Replique a estrutura de página + layout em `src/pages/<Dominio>Dashboard.tsx` e `src/components/<dominio>/<Dominio>DashboardLayout.tsx`, espelhando o padrão do Financeiro (filtros, `loading`, `error`, `reload`).
4. **Popular selects de empresa**: consuma `GET /api/v1/empresas` para preencher o seletor de empresa em todos os dashboards. Reaproveite a tipagem/estado já usado no Financeiro.
5. **Erros e carregamento**: mantenha skeleton/spinner e banners de erro nos novos layouts, garantindo feedback consistente ao usuário.
6. **Prompts rápidos para o Lovable**:
   - "Crie `src/components/financeiro/FinanceiroDashboardLayout.tsx` em React/TypeScript com filtros de data/empresa, cards de métricas, tabela de fluxo diário e tabela de parcelas, exibindo `loading` e `error` via skeleton e banner." (já implementado; use como referência)
   - "Implemente o hook `useVendasDashboard` que chama `/api/v1/vendas/...`, calcula métricas locais e expõe `filters`, `loading`, `error`, `metrics`, `items`, `reload`."
   - "Crie `VendasDashboardLayout` e `VendasDashboard.tsx` seguindo o mesmo padrão do Financeiro, com filtros, cards e tabela/lista de resultados, usando `reload` para atualizar os dados."

Seguindo estes passos, você terá dashboards consistentes em todos os domínios consumindo os endpoints já expostos pela API.
