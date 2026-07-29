# F0 — Descoberta: pedidos de compra no Dataweb (modo fiscal)

> Sessão de 30/07/2026. Contexto: SPEC_P3_MODO_FISCAL_NF_ENTRADA.md (repo
> tica-diniz-insights) precisa de um endpoint `GET /api/v1/compras/pedidos` que
> exponha os pedidos de compra do Dataweb (nº do pedido, OS vinculada, fornecedor,
> data, valor, situação) para o match NF→pedido.
> Ferramentas: `GET /debug/schema?like=` / `?table=` e `GET /debug/schema/dist`
> (agregados, sem PII) — criados nesta sessão, já em produção.

## Fatos verificados (produção, 30/07)

### Tabelas encontradas (`like=PEDIDO`, `like=SOLICITACAO`)

`PEDIDO`, `PEDIDO_ITEM`, `PEDIDOCOMPLEMENTO`, `PEDIDO_ITEMCOMPLEMENTO`,
`PEDIDOMANUAL`, `PEDIDODEVOLUCAO`, `SOLICITACAO`, `SOLICITACAO_ITEM`
(+ acessórias: CFGPEDIDOIMPRESSAO, DWPEDIDO*, INT$OPTICLICKPEDIDO, WEBCFGPEDIDO).

### Colunas-chave

- **PEDIDO**: `COD_PEDIDO`, `COD_EMPRESA`, `NUMEROPEDIDO`, `COD_FORNECEDOR`,
  `COD_PEDIDOTIPO` (SHORT), `NUMERODOCUMENTO`. **Sem datas nem valores** — o
  pedido é um "envelope" de envio ao fornecedor.
- **PEDIDO_ITEM**: liga o pedido aos itens de transação —
  `COD_TRANSACAO`, `COD_TRANSACAOITEM`, `COD_EMPRESA`,
  `COD_SOLICITACAOORIGEM`, `COD_EMPRESASOLICITACAOORIGEM`,
  `QUANTIDADESOLICITACAOORIGEM`, `QUANTIDADEENTREGUE`, `QUANTIDADECONFERIDA`.
- **SOLICITACAO**: `COD_SOLICITACAO`, `COD_EMPRESA`, `NUMEROSOLICITACAO`,
  `NOMEUSUARIO`. **SOLICITACAO_ITEM**: `COD_TRANSACAO`, `COD_TRANSACAOITEM`,
  `QUANTIDADEENTREGUE` — a solicitação também aponta itens de transação.
- **TRANSACAO**: entidade central de documentos — tem `DATAEMISSAO`,
  `TOTAL`/`TOTALPRODUTOS`, `SITUACAO`, `ENCERRADO`, `COD_PESSOA` (contraparte),
  `NUMEROTRANSACAO`, `TIPOTRANSACAO` (VARCHAR 3), `COD_TRANSACAOTIPO`,
  `COD_NATUREZAOPERACAO`, e **`COD_TRANSACAOORIGEM`/`COD_EMPRESAORIGEM`**
  (encadeamento de documentos — hipótese: liga a transação de compra à
  OS/venda de origem).

### Distribuições

- `PEDIDO.COD_PEDIDOTIPO`: **1 → 44.313** | **2 → 5.014**.
  Hipótese forte: 1 = pedidos de lentes sob encomenda (volume ≈ OS), 2 = pedidos
  de estoque (armações etc.). Confirmar cruzando com fornecedor.
- `TRANSACAO` inteira não aguenta GROUP BY a frio (timeout ~30s) — qualquer
  query de produção precisa de filtro por data/empresa e/ou índice.

## Modelo mental (hipótese a validar)

```
OS (venda)                    SOLICITACAO (por loja)          PEDIDO (envio ao fornecedor)
 transacao venda ──origem──▶  solicitacao_item ──▶ itens de   pedido_item ──▶ mesmos itens
                              TRANSACAO de compra              (COD_TRANSACAO/ITEM)
                                     │
                                     └─ TRANSACAO de compra: data, total, situação,
                                        fornecedor (COD_PESSOA), natureza da operação
```

O "número do pedido" que o fornecedor recebe (e que deve voltar no xPed da NF-e)
é provavelmente `PEDIDO.NUMEROPEDIDO` (por empresa). O elo pedido→OS passa por
`PEDIDO_ITEM.COD_TRANSACAO` → `TRANSACAO.COD_TRANSACAOORIGEM` (→ transação da
venda/OS) — **validar com dados reais**.

## Próximos passos do F0

1. Validar o elo transação-compra → OS: amostra agregada com filtro
   (ex.: transações dos itens de PEDIDO tipo 1 de um mês → distribuição de
   `COD_TRANSACAOTIPO`/`TIPOTRANSACAO`; conferir se `COD_TRANSACAOORIGEM`
   aponta transação com OS). Pode exigir mais um probe de debug com JOIN fixo.
2. Confirmar a semântica de `COD_PEDIDOTIPO` 1 vs 2 (cruzar com `COD_FORNECEDOR`
   → `pessoa.nome`: laboratórios vs fabricantes de armação).
3. Escrever `queries/compras/pedidos.sql`: pedido + fornecedor (nome/CNPJ via
   `pessoa`) + data/total/situação (via TRANSACAO dos itens) + OS de origem,
   filtrada por janela de datas e empresa, com `hasColumn` para colunas incertas.
4. Endpoint `GET /api/v1/compras/pedidos` (service/controller/rota nos DOIS
   registros de rota, conforme CLAUDE.md) + testes de contrato.
5. `pedidos_erp_cache` + sync no repo tica-diniz-insights (padrão sync-parcelas).

## Segurança dos probes

`/debug/schema` expõe só metadados; `/debug/schema/dist` só aceita colunas
categóricas (regex `COD_*|*TIPO*|SITUACAO|ENCERRADO`) e retorna contagens —
sem dados pessoais. Mantidos como ferramentas permanentes de diagnóstico.
