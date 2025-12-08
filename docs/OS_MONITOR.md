# Ordens de Serviço – Monitor de Produção

## Objetivo
Permitir acompanhamento da produção, atrasos, SLA e status das ordens de serviço.

---

# 1. ENDPOINT

## 1.1. Monitor de OS

### Rota
GET /api/v1/os/monitor

### Parâmetros
- empresa (string, obrigatório)
- dataInicio (YYYY-MM-DD, obrigatório)
- dataFim (YYYY-MM-DD, obrigatório)

### Exemplo
GET /api/v1/os/monitor?empresa=206&dataInicio=2025-01-01&dataFim=2025-01-31

### Resposta
{
  "ok": true,
  "data": [
    {
      "os_id": 9987,
      "empresa": "206",
      "cliente": "MARIA SOUZA",
      "data_entrada": "2025-01-05",
      "data_prometida": "2025-01-12",
      "data_entrega": null,
      "dias_atraso": 3,
      "status": "ATRASADA"
    }
  ],
  "error": null
}

### Status possíveis
- EM_PRODUCAO
- AGUARDANDO_CLIENTE
- FINALIZADA
- ATRASADA
