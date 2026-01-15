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
