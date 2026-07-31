# Catálogo (cadastro de produtos)

## Objetivo
Expor o **cadastro completo de produtos** do ERP (ITEM + PRODUTO), sem qualquer
junção com estoque, para sincronização de catálogo externo (Atlas). O
`codigo_barras` (`PRODUTO.CODIGOBARRA`, 0% nulo — ver `docs/ESTOQUE.md`) é a
chave estável por SKU usada pelo matching do catálogo canônico.

**Não confundir com `/estoque/completo`**: aquele endpoint é prateleira
(filtra `saldo > 0`, por empresa). Este é cadastro global — inclui itens sem
estoque (ex.: lentes sob encomenda) e não recebe parâmetro de empresa.

---

# 1. ENDPOINTS

## 1.1. Itens do cadastro

### Rota
GET /api/v1/catalogo/itens

### Parâmetros
- tipo (string, opcional): filtro CSV, case-insensitive.
  Valores: `ARMACOES`, `LENTES_GRAU`, `LENTES_CONTATO`, `ACESSORIOS`, `OUTROS`,
  alias `LENTES` (= grau + contato). `ALL`/vazio = todos.

### Exemplos
GET /api/v1/catalogo/itens
GET /api/v1/catalogo/itens?tipo=LENTES
GET /api/v1/catalogo/itens?tipo=LENTES_GRAU,LENTES_CONTATO

### Resposta
{
  "ok": true,
  "data": [
    {
      "cod_sku": 12345,
      "codigo_barras": "1234567",
      "ean": "7891234567890",
      "descricao": "6.00 LG VARILUX XR DESIGN 1.59 CRIZAL SAPPHIRE",
      "tipo": "LENTES_GRAU",
      "subcategoria": "LENTES_GRAU",
      "fornecedor_nome": "ESSILOR",
      "grife": "VARILUX",
      "preco_custo": 450.0,
      "preco_venda": 1290.0,
      "data_ultima_compra": "2026-06-10",
      "ativo": 1
    }
  ],
  "error": null
}

### Campos
| Campo | Fonte Firebird | Observações |
|---|---|---|
| `cod_sku` | `PRODUTO.COD_PRODUTO` | Chave interna |
| `codigo_barras` | `PRODUTO.CODIGOBARRA` | **Chave estável do sync** — 0% nulo |
| `ean` | `PRODUTO.GTIN` | Só valores válidos de 8–14 dígitos; senão null |
| `descricao` | `ITEM.DESCRICAO` | |
| `tipo` / `subcategoria` | heurística sobre descrição | Mesma regra de `estoque_completo.sql` (LG/GC/LC palavra isolada; sem o ramo `PRODUTOS`, que depende de transações) |
| `fornecedor_nome` | `FORNECEDOR_ITEM` → `PESSOA` | Vínculo deduplicado (1 por item, ordem alfabética) |
| `grife` | `ITEMCLASSIFICACAO` (dw 42) | `SEM MARCA` quando ausente |
| `preco_custo` | `PRODUTO.PRECOCUSTO` | Cadastro global, ~92% cobertura |
| `preco_venda` | `ITEM.PRECOVENDA` | |
| `data_ultima_compra` | `PRODUTO.DATAULTIMACOMPRA` | |
| `ativo`/`inativo` | runtime | Incluído apenas se a coluna existir no schema (candidatas: `ITEM.ATIVO`, `PRODUTO.ATIVO`, `ITEM.INATIVO` — padrão `hasColumn`) |

### Contrato
- Uma linha por `cod_sku`.
- Sem parâmetro de empresa (cadastro é global).
- Volume: retorna o cadastro inteiro do tipo filtrado — endpoint pensado para
  sync batch (ex.: cron diário do Atlas), não para autocomplete de UI.

---

# 2. Arquivos
- `queries/catalogo/itens_cadastro.sql`
- `src/services/catalogoService.js`
- `src/controllers/catalogoController.js`
- `src/routes/catalogoRoutes.js` (registrada em `index.js` **e** `src/routes/index.js`)
- `__tests__/catalogoItens.test.js`
