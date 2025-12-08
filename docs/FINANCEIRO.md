# Financeiro

## Objetivo
Disponibilizar uma visão consolidada das parcelas (a pagar e a receber) e do demonstrativo de resultado mensal (DRE), permitindo controle financeiro e análises gerenciais.

---

# 1. ENDPOINTS

## 1.1. Parcelas – Listagem Geral

### Rota
GET /api/v1/financeiro/parcelas

### Parâmetros
- empresa (string, obrigatório)
- dataInicio (YYYY-MM-DD, obrigatório)
- dataFim (YYYY-MM-DD, obrigatório)

### Exemplo
GET /api/v1/financeiro/parcelas?empresa=206&dataInicio=2025-01-01&dataFim=2025-01-31

### Resposta
{
  "ok": true,
  "data": [
    {
      "empresa": "206",
      "parcela_id": 1201,
      "tipo": "RECEBER",
      "situacao": "EM_ABERTO",
      "forma_pagamento": "PIX",
      "valor": 350.00,
      "data_emissao": "2025-01-02",
      "data_vencimento": "2025-01-15",
      "cliente": "JOÃO DA SILVA"
    }
  ],
  "error": null
}

---

## 1.2. DRE – Demonstrativo de Resultado

### Rota
GET /api/v1/financeiro/dre

### Parâmetros
- empresa (string, obrigatório)
- dataInicio (YYYY-MM-DD, obrigatório)
- dataFim (YYYY-MM-DD, obrigatório)

### Exemplo
GET /api/v1/financeiro/dre?empresa=206&dataInicio=2025-01-01&dataFim=2025-01-31

### Resposta
{
  "ok": true,
  "data": {
    "receita_bruta": 125000,
    "deducoes": 5000,
    "receita_liquida": 120000,
    "custo_produtos": 60000,
    "lucro_bruto": 60000,
    "despesas_operacionais": 30000,
    "resultado_operacional": 30000
  },
  "error": null
}
