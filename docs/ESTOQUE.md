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
      "acao_sugerida": "ANALISE PARA RECOMPRA"
    }
  ],
  "error": null
}

### Ações sugeridas
- SEM MOVIMENTO
- ANALISE PARA RECOMPRA
- ACOMPANHAMENTO
- PROMOCAO 20%
- LIQUIDA 30%
- LIQUIDA 50%
- ACAO ESPECIAL
- DADOS INSUFICIENTES

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
      "cod_sku": 12345,
      "cod_barras_interno": "1234567",
      "codigo_barras": "1234567",
      "ean": "7891234567890",
      "descricao": "ARMAÇÃO RAY-BAN RB5154 2000 51",
      "fornecedor_nome": "FORNECEDOR ABC",
      "grife": "RAYBAN",
      "quantidade_estoque": 5,
      "preco_custo": 150.00,
      "preco_venda": 0,
      "data_ultima_entrada": "2024-10-15",
      "data_ultima_venda": "2024-12-20",
      "dias_estoque": 106,
      "dias_sem_venda": 40,
      "acao_sugerida": "ACOMPANHAMENTO"
    }
  ],
  "error": null
}

### Campos de código de barras

| Campo | Fonte Firebird | Nullável | Descrição |
|---|---|---|---|
| `cod_barras_interno` | `PRODUTO.CODIGOBARRA` | Não (0%) | Cód. Barras gerado pela Diniz — sequencial, usado no PDV/scanner/etiqueta |
| `ean` | `PRODUTO.GTIN` | Sim | EAN do fabricante — null quando não cadastrado ou quando o campo contém valor inválido (campo histórico com lixo: textos, placeholders). Só retorna valores numéricos de 8–14 dígitos |
| `codigo_barras` | `PRODUTO.CODIGOBARRA` | Não | **Deprecated** — igual a `cod_barras_interno`, mantido para compatibilidade com o Frontend atual. Será removido após migração |

### Regra de unicidade

O endpoint retorna **uma linha por `cod_sku`**. A query filtra primeiro os
produtos com saldo positivo da empresa solicitada e só depois ranqueia os
vínculos de fornecedor, evitando processar o catálogo inteiro. Quando um produto
possui mais de um vínculo em `fornecedor_item`, as linhas já filtradas por loja
são ranqueadas por `data_ultima_entrada DESC NULLS LAST` e, em empate, por
`fornecedor_nome ASC`, mantendo apenas a primeira linha de cada SKU. O campo
`quantidade_estoque` continua vindo do saldo consolidado por produto em estoque,
sem soma por vínculo.
