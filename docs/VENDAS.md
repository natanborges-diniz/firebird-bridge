# Vendas

## Objetivo
Apresentar indicadores de vendas por empresa, vendedor, forma de pagamento e família de produtos.

---

# 1. ENDPOINTS

## 1.1. Resumo por Empresa e Vendedor

### Rota
GET /api/v1/vendas/resumo-empresa-vendedor

### Parâmetros
- empresa (string, obrigatório)
- dataInicio (YYYY-MM-DD, obrigatório)
- dataFim (YYYY-MM-DD, obrigatório)

### Exemplo
GET /api/v1/vendas/resumo-empresa-vendedor?empresa=206&dataInicio=2025-01-01&dataFim=2025-01-31

### Resposta
{
  "ok": true,
  "data": [
    {
      "empresa": "206",
      "vendedor": "CARLOS",
      "valor_total": 15800.50,
      "qtde_vendas": 32,
      "ticket_medio": 493.75
    }
  ],
  "error": null
}

---

## 1.2. Resumo por Formas de Pagamento

### Rota
GET /api/v1/vendas/resumo-formas-pagamento

### Parâmetros
- empresa
- dataInicio
- dataFim
- excluirCreditos (opcional, 0/1)

### Resposta
{
  "ok": true,
  "data": [
    { "forma_pagamento": "PIX", "total": 25000 },
    { "forma_pagamento": "CREDIÁRIO", "total": 12000 }
  ],
  "error": null
}

---

## 1.3. Resumo Diário Simples (cache diário)

### Rota
GET /api/v1/vendas/resumo-diario-simples

### Parâmetros
- empresa
- dataInicio
- dataFim
- excluirCreditos (opcional, 0/1)

### Resposta
{
  "ok": true,
  "data": [
    {
      "data_venda": "2025-11-05",
      "cod_empresa": 206,
      "vendedor": "CARLOS",
      "formapagamento": "CARTAO CREDITO",
      "qtd_vendas": 12,
      "total_bruto": 1500.00,
      "total_vendido": 1400.00,
      "total_desconto": 100.00,
      "total_pago_forma": 1400.00
    }
  ],
  "error": null
}

---

## 1.4. Auditoria por Formas de Pagamento (grid)

### Rota
GET /api/v1/vendas/auditoria-formas-pagamento

### Parâmetros
- empresa
- dataInicio
- dataFim
- excluirCreditos (opcional, 0/1)
- page (opcional)
- pageSize (opcional, máx 1000)

### Resposta
{
  "ok": true,
  "data": [
    {
      "empresa": "206",
      "vendedor": "CARLOS",
      "cod_transacao": 12345,
      "dataemissao": "2025-11-05",
      "formapagamento": "CARTAO CREDITO",
      "total_bruto": 150.00,
      "total_vendido": 140.00,
      "total_desconto": 10.00,
      "total_pago_forma": 140.00,
      "total_pago_transacao": 140.00,
      "total_bruto_rateado": 150.00,
      "total_desconto_rateado": 10.00
    }
  ],
  "error": null
}

---

## 1.5. Auditoria por Formas de Pagamento (light)

### Rota
GET /api/v1/vendas/auditoria-formas-pagamento-light

### Parâmetros
- empresa
- dataInicio
- dataFim
- excluirCreditos (opcional, 0/1)
- page (opcional)
- pageSize (opcional, máx 1000)

### Resposta
{
  "ok": true,
  "data": [
    {
      "empresa": "206",
      "vendedor": "CARLOS",
      "cod_transacao": 12345,
      "dataemissao": "2025-11-05",
      "formapagamento": "CARTAO CREDITO",
      "total_vendido": 140.00,
      "total_desconto": 10.00,
      "total_pago_forma": 140.00
    }
  ],
  "error": null
}

---

## 1.6. Análise por Família e Vendedor

### Rota
GET /api/v1/vendas/analise-familia-vendedor

### Parâmetros
- empresa
- dataInicio
- dataFim

### Resposta
{
  "ok": true,
  "data": [
    {
      "familia": "SOLAR",
      "vendedor": "CARLOS",
      "qtde": 18,
      "valor_total": 7200
    }
  ],
  "error": null
}

---

## 1.7. Análise por SKU

### Rota
GET /api/v1/vendas/analise-sku

### Parâmetros
- empresa
- dataInicio
- dataFim

### Resposta
{
  "ok": true,
  "data": [
    {
      "cod_sku": 12345,
      "descricao_item": "ARMACAO XYZ",
      "marca": "RAYBAN",
      "fornecedor": "FORNECEDOR ABC",
      "tipo_cod": 42,
      "tipo": "AR",
      "subcategoria_armacao": "AR",
      "is_armacao": 1,
      "estoque_atual": 8,
      "data_ultima_venda": "2025-11-05",
      "dias_desde_ultima_venda": 12,
      "data_ultimo_custo": "2025-09-18",
      "preco_custo": 120.50,
      "preco_venda_final": 400.00,
      "qtd_produtos": 8,
      "total_vendido": 3200
    }
  ],
  "error": null
}

### Observação de uso (OTB)
- Para armações, utilize **marca/grife** como referência principal.
- Para lentes, utilize **família/tipo**.
- Itens sem família serão classificados como **OUTROS** quando não forem armações.

---

## 1.8. Recebimentos — detalhe de parcelas pagas (Fase 1 — metas/comissões)

Base de metas e comissões sobre **valores recebidos** (regime de caixa):
parcela com `datapagamento` preenchido, valor = `valorpago` (nunca o previsto
`valor`). Saldo em aberto não entra. Garantia excluída (venda regular).

### Rota
`GET /api/v1/vendas/recebimentos`

### Parâmetros
- `empresa` (opcional; `ALL`/vazio = todas) — aceita lista `1,9,13`
- `dataInicio` (obrigatório, `YYYY-MM-DD`) — período do **pagamento**
- `dataFim` (obrigatório, `YYYY-MM-DD`)
- `cache=0` desliga o cache (TTL padrão curto: 60s, `RECEBIMENTOS_CACHE_TTL_MS`)

### Resposta (`data[]` — uma linha por parcela paga)
```json
{
  "ok": true,
  "data": [
    {
      "cod_empresa": 1,
      "cod_vendedor": 77,
      "vendedor_nome": "MARIA",
      "cod_transacao": 123456,
      "dataemissao": "2026-07-15",
      "data_pagamento": "2026-07-21",
      "cod_formapagamentotipo": 3,
      "forma_categoria": "CARTAO_CREDITO",
      "origem": "SALDO_ANTERIOR",
      "valor_recebido": 150.00
    }
  ],
  "error": null
}
```

- `forma_categoria`: `AVISTA` (dinheiro, 3%) · `CHEQUE` (1%) ·
  `CARTAO_CREDITO` (2%) · `CARTAO_DEBITO` (comissiona como à vista, categoria
  separada p/ relatório) · `CREDIARIO` (carnê/boleto, 1%) · `CREDITOS`
  (tipo 6 — 0%, não soma em meta/comissão) · `BANCO`/`OUTROS`
  (**pendentes de validação** — PIX/boleto podem cair aí; `npm run validar:recebimentos`).
- `origem`: `VENDA_PERIODO` se `dataemissao >= dataInicio`, senão `SALDO_ANTERIOR`.
- Falhas parciais do fan-out aparecem em `meta.empresasComErro` (ok:true).

## 1.9. Recebimentos — agregado diário

Mesmos parâmetros de 1.8. Agrupa o detalhe por
`(cod_empresa, cod_vendedor, data_pagamento, forma_categoria, origem)` —
shape consumido pelo sync `recebimentos_agregado_diario` (Supabase).

### Rota
`GET /api/v1/vendas/recebimentos/agregado`

### Resposta (`data[]`)
```json
{
  "cod_empresa": 1,
  "cod_vendedor": 77,
  "vendedor_nome": "MARIA",
  "data_pagamento": "2026-07-21",
  "forma_categoria": "AVISTA",
  "origem": "VENDA_PERIODO",
  "valor_recebido": 150.00,
  "qtd_parcelas": 2
}
```

## 1.10. Emitidos por vendedor (modo alternativo "emitido em OS")

Vendas por transação com filtro em `transacao.dataemissao`; valor =
`SUM(TOTAL - VALORDESCONTO - TOTALIPI)` dos itens. Garantia excluída.

### Rota
`GET /api/v1/vendas/emitidos`

### Parâmetros
Iguais a 1.8 (`empresa`, `dataInicio`, `dataFim` — aqui período de **emissão**).

### Resposta (`data[]` — uma linha por transação)
```json
{
  "cod_empresa": 1,
  "cod_vendedor": 77,
  "vendedor_nome": "MARIA",
  "cod_transacao": 123456,
  "dataemissao": "2026-07-21",
  "valor_emitido": 480.00
}
```

## 1.11. Devoluções com restituição (PENDENTE VALIDAÇÃO)

Devoluções com **restituição de valores** (sem geração de crédito) por
vendedor — abatem meta/comissão na semana da restituição. A distinção
crédito × restituição ainda **não foi validada** no schema real
(`npm run validar:recebimentos`, seção d). Fallback gracioso: retorna `[]`
se o schema não tiver `entradanotafiscaldevolucao.cod_vendedor`.

### Rota
`GET /api/v1/vendas/devolucoes-restituicao`

### Parâmetros
Iguais a 1.8 (período = `datapagamento` da restituição).

### Resposta (`data[]`)
```json
{
  "cod_empresa": 1,
  "cod_vendedor": 77,
  "vendedor_nome": "MARIA",
  "cod_transacao": 99887,
  "dataemissao": "2026-07-18",
  "data_restituicao": "2026-07-21",
  "valor_restituido": 250.00
}
```
