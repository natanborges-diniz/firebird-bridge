# Firebird Bridge

Bridge HTTP → Firebird para expor consultas consolidadas via Express.

## Configuração
1. Crie um arquivo `.env` (opcional em produção) com:
   ```env
   FIREBIRD_HOST=192.168.0.1
   FIREBIRD_DATABASE=/caminho/do/banco.FDB
   FIREBIRD_USER=SYSDBA
   FIREBIRD_PASSWORD=masterkey
   PORT=3000
   ```
2. Instale dependências e execute:
   ```bash
npm install
npm start
```

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
