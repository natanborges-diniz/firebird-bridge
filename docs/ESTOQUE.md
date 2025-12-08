# Estoque

## Objetivo
Fornecer visão gerencial do estoque, com giro, cobertura, CAF, curva ABC e ação sugerida para cada item.

---

# 1. ENDPOINT

## 1.1. Análise de Estoque

### Rota
GET /api/v1/estoque/analise

### Parâmetros
- empresa (string, obrigatório)
- dataInicio (YYYY-MM-DD, obrigatório)
- dataFim (YYYY-MM-DD, obrigatório)

### Exemplo
GET /api/v1/estoque/analise?empresa=206&dataInicio=2025-01-01&dataFim=2025-01-31

### Resposta
{
  "ok": true,
  "data": [
    {
      "empresa": "206",
      "produto": "12345",
      "descricao": "ÓCULOS PREMIUM",
      "estoque_atual": 12,
      "vendas_periodo": 3,
      "giro": 0.25,
      "cobertura": 4,
      "acao_sugerida": "RECOMPRA"
    }
  ],
  "error": null
}

### Ações sugeridas
- RECOMPRA
- MANTER
- LIQUIDA_30
- ESTOQUE_PARADO
