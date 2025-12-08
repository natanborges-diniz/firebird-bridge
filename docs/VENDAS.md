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

## 1.3. Análise por Família e Vendedor

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
