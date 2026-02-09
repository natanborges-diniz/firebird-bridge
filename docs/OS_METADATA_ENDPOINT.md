# Endpoint de Metadata de Receitas (OS)

## Visão Geral

O endpoint `/api/v1/os/receitas-metadata` permite descobrir dinamicamente quais tabelas no Firebird contêm determinadas colunas. Isso é essencial para determinar a estrutura correta de queries quando há diferenças entre bancos de dados.

## Problema que Resolve

Quando a query de hub de receitas foi modificada para usar `ordemservicooticalente.cod_ordemservicocaixa`, surgiram problemas se essa coluna não existir no banco Firebird:
- Se a coluna não existe ou está vazia, o join não encontra registros
- Produtos retornam como NULL
- É necessário descobrir quais colunas estão disponíveis para ajustar a query

Este endpoint resolve esse problema permitindo descobrir:
1. Se `ORDEMSERVICOOTICALENTE` possui `COD_ORDEMSERVICOCAIXA`
2. Se `TRANSACAO_ITEM` possui `COD_ORDEMSERVICOCAIXA`
3. Quais outras colunas de vínculo existem (ex: `NUMEROORDEMSERVICO`, `COD_TRANSACAO`)
4. Todas as colunas disponíveis em cada tabela relevante

## Endpoints Disponíveis

Todas essas rotas apontam para a mesma funcionalidade:
- `GET /api/v1/os/receitas-metadata`
- `GET /api/v1/os/receita-metadata` (singular)
- `GET /api/v1/os/receitas/metadata` (com barra)

## Parâmetros

### `campos` (obrigatório)
Lista de colunas a procurar, separadas por vírgula.

**Exemplo:**
```
campos=COD_ORDEMSERVICOCAIXA,COD_TRANSACAO,COD_ITEM,NUMEROORDEMSERVICO
```

### `expand` (opcional)
Quando definido como `1` ou `true`, retorna todas as colunas das tabelas que contêm os campos solicitados.

**Valores aceitos:**
- `1` 
- `true` (case-insensitive)

**Sem expand:**
```
expand=0  (ou omitir o parâmetro)
```

## Colunas de Chave de OS

O endpoint identifica automaticamente as seguintes colunas como "chaves de OS":
- `COD_ORDEMSERVICOCAIXA`
- `NUMEROORDEMSERVICO`
- `COD_TRANSACAO`
- `COD_CLIENTE`
- `COD_PESSOA`

## Formato de Resposta

### Resposta de Sucesso (200 OK)

```json
{
  "ok": true,
  "data": [
    {
      "tabela": "TRANSACAO_ITEM",
      "campos_encontrados": ["COD_TRANSACAO", "COD_ITEM"],
      "chaves_os": ["COD_TRANSACAO"],
      "possui_chave_os": true,
      "campos_tabela": null
    },
    {
      "tabela": "ORDEMSERVICOCAIXA",
      "campos_encontrados": ["NUMEROORDEMSERVICO", "COD_TRANSACAO"],
      "chaves_os": ["NUMEROORDEMSERVICO", "COD_TRANSACAO"],
      "possui_chave_os": true,
      "campos_tabela": null
    }
  ],
  "error": null
}
```

### Com expand=1

Quando `expand=1` é usado, `campos_tabela` contém todas as colunas da tabela:

```json
{
  "ok": true,
  "data": [
    {
      "tabela": "TRANSACAO_ITEM",
      "campos_encontrados": ["COD_TRANSACAO", "COD_ITEM"],
      "chaves_os": ["COD_TRANSACAO"],
      "possui_chave_os": true,
      "campos_tabela": [
        "COD_TRANSACAO",
        "COD_ITEM",
        "QUANTIDADE",
        "VALOR_UNITARIO",
        "DESCONTO",
        ...
      ]
    }
  ],
  "error": null
}
```

### Resposta de Erro (400 Bad Request)

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Informe ao menos um campo em ?campos=CAMPO1,CAMPO2",
    "details": {
      "campos": ""
    }
  }
}
```

## Exemplos de Uso

### Exemplo 1: Verificar se TRANSACAO_ITEM tem COD_ORDEMSERVICOCAIXA

**Request:**
```http
GET /api/v1/os/receitas-metadata?campos=COD_ORDEMSERVICOCAIXA,COD_TRANSACAO,COD_ITEM,NUMEROORDEMSERVICO&expand=1
```

**Análise da Resposta:**

Se `TRANSACAO_ITEM` estiver na resposta com `COD_ORDEMSERVICOCAIXA` em `campos_encontrados`:
```json
{
  "tabela": "TRANSACAO_ITEM",
  "campos_encontrados": ["COD_ORDEMSERVICOCAIXA", "COD_TRANSACAO", "COD_ITEM"],
  "chaves_os": ["COD_ORDEMSERVICOCAIXA", "COD_TRANSACAO"],
  "possui_chave_os": true
}
```
✅ **Conclusão:** A coluna existe, a query atual deve funcionar.

Se `TRANSACAO_ITEM` NÃO tiver `COD_ORDEMSERVICOCAIXA` em `campos_encontrados`:
```json
{
  "tabela": "TRANSACAO_ITEM",
  "campos_encontrados": ["COD_TRANSACAO", "COD_ITEM"],
  "chaves_os": ["COD_TRANSACAO"],
  "possui_chave_os": true
}
```
❌ **Conclusão:** A coluna não existe, precisa usar caminho alternativo (ex: `COD_TRANSACAO` ou `NUMEROORDEMSERVICO`).

### Exemplo 2: Verificar se ORDEMSERVICOOTICALENTE tem COD_ORDEMSERVICOCAIXA

**Request:**
```http
GET /api/v1/os/receitas-metadata?campos=COD_ORDEMSERVICOCAIXA,COD_TRANSACAO&expand=1
```

**Interpretação:**
- Se `ORDEMSERVICOOTICALENTE` aparecer com `COD_ORDEMSERVICOCAIXA` em `campos_encontrados`, o join pode ser feito por `cod_ordemservicocaixa`
- Caso contrário, use `cod_transacao` como vínculo

### Exemplo 3: Descobrir campos de vínculo com OS

**Request:**
```http
GET /api/v1/os/receitas-metadata?campos=NUMEROORDEMSERVICO,COD_OS
```

**Resposta Possível:**
```json
{
  "ok": true,
  "data": [
    {
      "tabela": "TRANSACAO_ITEM",
      "campos_encontrados": ["NUMEROORDEMSERVICO"],
      "chaves_os": ["NUMEROORDEMSERVICO"],
      "possui_chave_os": true,
      "campos_tabela": null
    }
  ]
}
```

**Interpretação:**
- `TRANSACAO_ITEM` tem a coluna `NUMEROORDEMSERVICO`
- Pode-se usar essa coluna para fazer join direto com OS

### Exemplo 4: Listar todas as colunas de tabelas relevantes

**Request:**
```http
GET /api/v1/os/receitas-metadata?campos=COD_TRANSACAO&expand=1
```

Isso retorna todas as colunas de cada tabela que contém `COD_TRANSACAO`, permitindo descobrir outras possíveis colunas de vínculo.

## Caso de Uso: Ajustar Query do Hub de Receitas

### Passo 1: Descobrir Estrutura do Banco
```bash
curl "http://seu-servidor/api/v1/os/receitas-metadata?campos=COD_ORDEMSERVICOCAIXA,COD_TRANSACAO,NUMEROORDEMSERVICO&expand=1"
```

### Passo 2: Analisar Resposta

**Cenário A: COD_ORDEMSERVICOCAIXA existe em ORDEMSERVICOOTICALENTE**
- ✅ Usar a query atual que faz join por `osl.cod_ordemservicocaixa`

**Cenário B: COD_ORDEMSERVICOCAIXA NÃO existe em ORDEMSERVICOOTICALENTE**
- ❌ Query atual falhará
- ✅ Alternativas:
  1. Usar join por `osl.cod_transacao`
  2. Verificar outros vínculos disponíveis conforme a resposta do metadata

### Passo 3: Ajustar hub_receitas.sql

**Opção 1: Join por NUMEROORDEMSERVICO**
```sql
LEFT JOIN itens_lente lensitems
  ON lensitems.numeroordemservico = ocx.numeroordemservico
```

**Opção 2: Continuar por transação mas com critério adicional**
```sql
LEFT JOIN itens_lente lensitems
  ON lensitems.cod_transacao = ocx.cod_transacao
```

## Implementação Técnica

### Como Funciona

1. O endpoint consulta as tabelas do sistema Firebird (`rdb$relation_fields` e `rdb$relations`)
2. Busca por colunas específicas em todas as tabelas não-sistema
3. Identifica quais tabelas contêm as colunas solicitadas
4. Classifica as colunas encontradas como:
   - `campos_encontrados`: colunas que foram solicitadas e existem
   - `chaves_os`: colunas que são identificadas como chaves de OS
5. Se `expand=1`, busca todas as colunas das tabelas encontradas

### Código Relevante

- **Controller:** `src/controllers/osController.js` - função `receitaMetadata()`
- **Service:** `src/services/osService.js` - função `getReceitaMetadata()`
- **Rotas:** `src/routes/osRoutes.js`

## Notas de Segurança

- O endpoint apenas lê metadados do schema do banco
- Não expõe dados de tabelas ou registros
- Filtra apenas tabelas de usuário (exclui tabelas de sistema)
- Não permite SQL injection (usa queries parametrizadas)

## Troubleshooting

### Erro: "Informe ao menos um campo"
**Causa:** Parâmetro `campos` não foi fornecido ou está vazio  
**Solução:** Adicione `?campos=CAMPO1,CAMPO2` à URL

### Resposta vazia (data: [])
**Causa:** Nenhuma tabela no banco contém os campos solicitados  
**Solução:** Verifique se os nomes das colunas estão corretos (use uppercase)

### Erro 500
**Causa:** Problema na conexão com Firebird ou erro interno  
**Solução:** Verifique logs do servidor e configuração do banco

## Referências

- [Firebird System Tables](https://firebirdsql.org/file/documentation/html/en/refdocs/fblangref30/firebird-30-language-reference.html#fblangref30-appx01)
- [RDB$RELATION_FIELDS](https://firebirdsql.org/file/documentation/html/en/refdocs/fblangref30/firebird-30-language-reference.html#fblangref30-appx01-rdb$relation_fields)
