# Firebird Bridge – Architecture Guide

Este documento descreve **como o projeto está organizado hoje** e define um **padrão fixo** para criarmos novos módulos (Vendas, Estoque, OS, Financeiro, etc.) sem quebrar rotas, caminhos de SQL nem nomes de arquivos.

> Objetivo: toda nova feature deve seguir este guia.  
> Assim evitamos: `Cannot GET /...`, `ENOENT: ... .sql` e confusão de nomes.

---

## 1. Visão Geral

O projeto é um **bridge HTTP → Firebird** (Node + Express) publicado no Railway.

- Conecta direto no banco Firebird (Dataweb)
- Expõe endpoints REST estáveis (`/api/v1/...`)
- Cada módulo usa **SQL em arquivos separados** dentro da pasta `queries/`
- O frontend (Lovable) só consome a API pública do Railway

---

## 2. Estrutura de Pastas (Backend)

Estrutura geral atual:

```text
queries/
  empresas/
  estoque/
  financeiro/
  os/
  vendas/

src/
  components/
    financeiro/
      FinanceiroDashboardLayout.tsx

  controllers/
    empresaController.js
    estoqueController.js
    financeiroController.js
    osController.js
    vendasAnaliseController.js
    vendasController.js

  db/
    index.js

  hooks/
    ... (hooks usados no frontend em Lovable)

  pages/
    ... (páginas React – Lovable)

  routes/
    empresas.routes.js
    estoque.routes.js
    financeiro.routes.js
    index.js
    os.routes.js
    vendas.routes.js

  services/
    empresaService.js
    estoqueService.js
    financeiroService.js
    osMonitor.ts
    osService.js
    vendasAnaliseService.js
    vendasService.js
    utils/
      loadSQL.js

  utils/
    ... (helpers gerais, ex.: osMetrics.ts)
