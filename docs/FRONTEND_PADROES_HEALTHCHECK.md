# Padrões de integração Frontend ↔ Firebird Bridge (Health Check)

## Endpoint oficial
- Método: `GET`
- URL: `/api/v1/health`
- Sem autenticação obrigatória.

Também existe endpoint de liveness:
- Método: `GET`
- URL: `/health`
- Uso: apenas verificar se o processo HTTP está no ar.

## Contrato de resposta

### 200 OK (saudável)
```json
{
  "status": "ok",
  "version": "1.0.0",
  "time": "2026-02-14T01:13:31.855Z",
  "uptime_s": 1890,
  "db": { "connected": true }
}
