# Catálogo (cadastro de produtos)

## Objetivo
Expor o **cadastro completo de produtos** do ERP (ITEM + PRODUTO), sem qualquer
junção com estoque, para sincronização de catálogo externo (Atlas). O
`codigo_barras` (`PRODUTO.CODIGOBARRA`, 0% nulo — ver `docs/ESTOQUE.md`) é a
chave estável por SKU usada pelo matching do catálogo canônico.

**Não confundir com `/estoque/completo`**: aquele endpoint é prateleira
(filtra `saldo > 0`, por empresa). Este é cadastro global — inclui itens sem
estoque (lentes sob encomenda) e não recebe parâmetro de empresa.

**Volume**: o cadastro tem **~1.035.000 produtos** (medido em 31/07/2026 via
`/debug/schema/dist`). Por isso o endpoint é **sempre paginado** e retorna
**só itens ativos por padrão**.

---

# 1. ENDPOINTS

## 1.1. Itens do cadastro

### Rota
GET /api/v1/catalogo/itens

### Parâmetros
- `tipo` (string, opcional): filtro CSV, case-insensitive.
  Valores: `ARMACOES`, `LENTES_GRAU`, `LENTES_CONTATO`, `ACESSORIOS`, `OUTROS`,
  alias `LENTES` (= grau + contato). `ALL`/vazio = todos.
- `limit` (int, opcional): tamanho da página. Padrão **5000**, máx 50000.
- `offset` (int, opcional): deslocamento. Padrão 0.
- `incluirInativos` (opcional): `1`/`true` inclui itens com `ITEM.ATIVO = 'F'`.
  Padrão: só ativos.

### Exemplos
GET /api/v1/catalogo/itens?tipo=LENTES
GET /api/v1/catalogo/itens?tipo=LENTES&limit=5000&offset=5000
GET /api/v1/catalogo/itens?tipo=ARMACOES&incluirInativos=1

### Resposta
{
  "ok": true,
  "data": [
    {
      "cod_sku": "12345",
      "codigo_barras": "0000117",
      "ean": "7891234567890",
      "descricao": "LG AO EASY1.59 POL IN",
      "cod_produtotipo": 7,
      "tipo": "LENTES_GRAU",
      "subcategoria": "LENTES_GRAU",
      "fornecedor_nome": "ESSILOR",
      "grife": "VARILUX",
      "preco_custo": 97.5,
      "preco_venda": 292.5,
      "data_ultima_compra": null,
      "ativo": "T"
    }
  ],
  "error": null
}

Erros de consulta retornam `code: "QUERY_ERROR"` com a mensagem do driver em
`details.firebird` (endpoint interno de sync — facilita diagnóstico).

### Campos
| Campo | Fonte Firebird | Observações |
|---|---|---|
| `cod_sku` | `PRODUTO.COD_PRODUTO` | Chave interna |
| `codigo_barras` | `PRODUTO.CODIGOBARRA` | **Chave estável do sync** — 0% nulo |
| `ean` | `PRODUTO.GTIN` | Só valores válidos de 8–14 dígitos; senão null |
| `descricao` | `ITEM.DESCRICAO` | |
| `cod_produtotipo` | `PRODUTO.COD_PRODUTOTIPO` | 7 = lentes de grau, 13 = armações, 1 = cesto misto (mapeado em `queries/debug/produto_tipo_samples.sql`) |
| `tipo` / `subcategoria` | derivado | Prioridade: GC/LC na descrição → `LENTES_CONTATO`; `cod_produtotipo` 7/13; heurística LG/OC/AR/AC (palavra isolada, mesma regra de `estoque_completo.sql`) |
| `fornecedor_nome` | `FORNECEDOR_ITEM (PRINCIPAL='T')` → `PESSOA` | `SEM FORNECEDOR` quando não há vínculo principal |
| `grife` | `ITEMCLASSIFICACAO` (dw 42) | `SEM MARCA` quando ausente |
| `preco_custo` | `PRODUTO.PRECOCUSTO` | Cadastro global, ~92% cobertura |
| `preco_venda` | `ITEM.PRECOVENDA` | |
| `data_ultima_compra` | `PRODUTO.DATAULTIMACOMPRA` | |
| `ativo` | `ITEM.ATIVO` ('T'/'F') | Coluna detectada em runtime (padrão `hasColumn`) |

### Contrato e performance
- Uma linha por `cod_sku`, ordenada por `cod_sku` (paginação estável).
- Filtro `tipo` no SQL é um **superset barato** (`COD_PRODUTOTIPO` + LIKEs);
  o rótulo exato é refinado no service — por isso uma página pode retornar
  menos linhas que `limit` mesmo sem ser a última. **Fim da paginação = página
  com 0 linhas.**
- Medido em produção (31/07/2026): 200 linhas ≈ 6 s; 5000 linhas ≈ 14 s.
- Consumidor previsto: cron diário do Atlas iterando páginas de 5000.

---

# 2. Arquivos
- `queries/catalogo/itens_cadastro.sql`
- `src/services/catalogoService.js`
- `src/controllers/catalogoController.js`
- `src/routes/catalogoRoutes.js` (registrada em `index.js` **e** `src/routes/index.js`)
- `__tests__/catalogoItens.test.js`

# 3. Histórico de decisões
- Marcadores de runtime (`ATIVO_SELECT`, `WHERE`, `ROWS`) nunca devem aparecer
  literalmente em comentários do SQL — o replace de runtime atinge a primeira
  ocorrência (regressão corrigida em 31/07/2026, "Token unknown: item").
- CHARs do Firebird chegam com padding — `tipo`/`subcategoria`/`ativo` são
  TRIMados no SQL/service.
- Fornecedor deduplicado pelo flag `FORNECEDOR_ITEM.PRINCIPAL = 'T'` (a versão
  com `ROW_NUMBER` sobre a tabela inteira era o gargalo de performance).
