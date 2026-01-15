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
