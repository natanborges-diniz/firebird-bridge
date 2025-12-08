# Contratos de API – Firebird Bridge

Este documento define os **padrões obrigatórios** de contratos entre o Firebird Bridge e os consumidores (Lovable, outros serviços).

Ele é a **fonte da verdade** para:
- Nomes de parâmetros
- Formato de resposta
- Tratamento de erros

---

## 1. Convenções gerais

- **Base URL (produção):**
https://firebird-bridge-production.up.railway.app/api/v1
- **Formato de dados:** JSON UTF-8  
- **Datas:** sempre no formato `YYYY-MM-DD` (ex.: `2025-12-08`)  
- **Números:** retornados como número JSON (sem formatação de moeda/ponto/vírgula)  
- **Time zone lógico:** datas normalmente tratadas como **data de calendário**, sem hora.

---

## 2. Parâmetros padrão

Os módulos (VENDAS, FINANCEIRO, ESTOQUE, OS) devem, sempre que fizer sentido, reutilizar estes nomes.

### 2.1. Filtro de empresa

- Nome: `empresa`
- Tipo: `string`
- Descrição: código da empresa conforme ERP/Dataweb (ex.: `206`).

Quando suportar múltiplas empresas:

- Formato: string com valores separados por vírgula

Exemplo:

```http
GET /api/v1/vendas/resumo-empresa-vendedor?empresa=206,207
2.2. Filtro de período (data)
	•	dataInicio – data inicial (inclusiva)
	•	dataFim – data final (inclusiva)
	•	Formato: YYYY-MM-DD

Exemplo:
GET /api/v1/financeiro/parcelas?empresa=206&dataInicio=2025-01-01&dataFim=2025-01-31

2.3. Paginação (quando aplicável)

Para endpoints com potencial de grande volume de dados:
	•	page – número da página (padrão: 1)
	•	pageSize – itens por página (padrão: 50, máximo recomendado: 200)

Exemplo:

GET /api/v1/vendas/resumo-empresa-vendedor?empresa=206&page=1&pageSize=50

Quando o endpoint não suportar paginação, isso deve estar claro no MD do módulo.

⸻

3. Formato padrão de resposta

Todas as rotas da API devem sempre seguir o formato abaixo.

3.1. Sucesso

{
  "ok": true,
  "data": <payload>,
  "error": null
}

Onde <payload> pode ser:
	•	Um array de registros (lista)
	•	Um objeto (ex.: resumo, health, etc.)

Exemplos:

Lista de registros:

{
  "ok": true,
  "data": [
    {
      "empresa": 206,
      "vendedor": "JOAO",
      "valorTotal": 12345.67
    }
  ],
    "error": null
}

Objeto único:

{
  "ok": true,
  "data": {
    "status": "UP",
    "db": "UP"
  },
  "error": null
}

Quando houver paginação, incluir um campo meta:

{
  "ok": true,
  "data": [
    { "empresa": 206, "vendedor": "JOAO", "valorTotal": 12345.67 }
  ],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 120,
    "totalPages": 3
  },
  "error": null
}

Regra: ok e error sempre existem. Em sucesso, error é null.

3.2. Erro

Em qualquer situação de erro, o formato é:

{
  "ok": false,
  "data": null,
  "error": {
    "code": "CÓDIGO_TÉCNICO",
    "message": "Mensagem legível",
    "details": null
  }
}

Exemplos:

Parâmetros inválidos:

{
  "ok": false,
  "data": null,
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Parâmetros inválidos ou ausentes",
    "details": {
      "missing": ["empresa", "dataInicio"]
    }
  }
}

Banco Firebird indisponível:

{
  "ok": false,
  "data": null,
  "error": {
    "code": "FIREBIRD_UNAVAILABLE",
    "message": "Não foi possível conectar ao banco Firebird",
    "details": null
  }
}

Erro interno genérico:

{
  "ok": false,
  "data": null,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Erro inesperado ao processar a requisição",
    "details": null
  }
}

4. Códigos de erro padrão

Os controllers devem sempre utilizar um destes códigos:
	•	INVALID_PARAMS
Erro de validação de parâmetros (falta campo obrigatório, formato inválido, etc.).
	•	NOT_FOUND
Quando um recurso esperado não foi encontrado (ex.: ID inexistente).
	•	FIREBIRD_UNAVAILABLE
Problema de conexão ou time-out com o banco Firebird.
	•	INTERNAL_ERROR
Qualquer exceção não tratada explicitamente.

Se necessário, módulos específicos podem definir códigos adicionais, porém sempre documentados no MD do módulo (ex.: DRE_CONFIG_ERROR).

⸻

5. Convenções por módulo

Cada módulo tem documentação própria, mas deve respeitar este contrato base:
	•	VENDAS￼
	•	FINANCEIRO￼
	•	ESTOQUE￼
	•	OS_MONITOR￼

Regras:
	1.	Todos os exemplos nesses arquivos devem usar:
	•	Parâmetros empresa, dataInicio, dataFim quando aplicável;
	•	Respostas no formato { ok, data, error } (e meta quando houver paginação).
	2.	Qualquer endpoint novo deve ser:
	•	Documentado primeiro no MD do módulo;
	•	Implementado seguindo o padrão deste arquivo.

⸻

6. Versão da API
	•	Versão atual: v1
	•	Prefixo obrigatório: /api/v1/...

Quebras de contrato ou mudanças incompatíveis devem gerar uma nova versão (v2) em novo prefixo, sem quebrar clientes existentes.

⸻

Atualizado em: Dez/2025
---

## 2️⃣ Padrão de resposta nos controllers (modelo pra você aplicar)

Agora, o passo é **fazer os controllers obedecerem esse contrato**.

### Exemplo genérico de helper (`src/utils/apiResponse.js`)

Cria um helper central (se ainda não existir):

```js
// src/utils/apiResponse.js
function success(res, data, meta) {
  const payload = { ok: true, data, error: null };
  if (meta) payload.meta = meta;
  return res.json(payload);
}

function failure(res, code, message, details = null, status = 500) {
  return res.status(status).json({
    ok: false,
    data: null,
    error: {
      code,
      message,
      details
    }
  });
}

module.exports = {
  success,
  failure
};

Exemplo de controller ANTES
async function listarParcelas(req, res) {
  try {
    const { empresa, dataInicio, dataFim } = req.query;
    const rows = await financeiroService.getParcelas({ empresa, dataInicio, dataFim });
    res.json(rows); // << direto, sem envelope
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
}

Exemplo de controller DEPOIS (seguindo API_CONTRATO.md)
const { success, failure } = require('../utils/apiResponse');

async function listarParcelas(req, res) {
  try {
    const { empresa, dataInicio, dataFim } = req.query;

    if (!empresa || !dataInicio || !dataFim) {
      return failure(
        res,
        'INVALID_PARAMS',
        'Parâmetros obrigatórios ausentes',
        { missing: ['empresa', 'dataInicio', 'dataFim'] },
        400
      );
    }

    const rows = await financeiroService.getParcelas({ empresa, dataInicio, dataFim });

    return success(res, rows);
  } catch (err) {
    console.error(err);

    // Exemplo simples: aqui você pode refinar por tipo de erro (conexão, etc.)
    return failure(
      res,
      'INTERNAL_ERROR',
      'Erro inesperado ao processar a requisição'
    );
  }
}

module.exports = {
  listarParcelas
};

Mesma lógica vale para:
	•	VENDAS
	•	ESTOQUE
	•	OS_MONITOR
	•	/health (nesse caso, data é só um objeto { status: 'UP', db: 'UP' })
