# Estoque

## Objetivo
Fornecer visão gerencial do estoque, com giro, cobertura, CAF, curva ABC e ação sugerida para cada item.

---

# 1. ENDPOINTS

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

---

## 1.2. Estoque Completo (prateleira)

### Rota
GET /api/v1/estoque/completo

### Parâmetros
- empresa (string, obrigatório)
- dataReferencia (YYYY-MM-DD, opcional, apenas informativo)

### Exemplo
GET /api/v1/estoque/completo?empresa=206

### Resposta
{
  "ok": true,
  "data": [
    {
      "empresa_nome": "Antonio Agú",
      "cod_empresa": 206,
      "fornecedor_cod_pessoa": 123,
      "fornecedor_nome": "FORNECEDOR ABC",
      "grife": "RAYBAN",
      "codigo_barras": "7891234567890",
      "descricao_item": "ARMAÇÃO RAY-BAN RB5154 2000 51",
      "quantidade_estoque": 5,
      "preco_custo": 150.00,
      "data_ultima_entrada": "2024-10-15",
      "data_ultima_venda": "2024-12-20",
      "dias_sem_venda": 40,
      "cod_armacao": 12345
    }
  ],
  "error": null
}
