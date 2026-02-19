# Campo `tem_receita` no endpoint `/api/v1/os/monitor-ultima-etapa`

## Objetivo
Permitir que o frontend filtre OS com/sem receita **sem depender de cache local**.

## Endpoint
- `GET /api/v1/os/monitor-ultima-etapa`

## Novo campo na resposta
- `tem_receita` (inteiro: `1` ou `0`)

### Regra de cálculo no Bridge
`tem_receita = 1` quando qualquer condição for verdadeira:
1. `ordemservicocaixa.cod_clientereceita IS NOT NULL`
2. Existe registro em `otiordemservicootica` para `cod_ordemservicocaixa`
3. Existe registro em `ordemservicooticalente` para `cod_transacao`
4. Existe registro em `otiordemservicootica_lente` para `cod_transacao`

Caso contrário:
- `tem_receita = 0`

## Uso recomendado no frontend
- Filtro "Com receita": `tem_receita === 1`
- Filtro "Sem receita": `tem_receita === 0`
- Sem filtro: não aplicar condição

## Observação
O campo já vem no payload principal de monitor, então não é necessário buscar Hub Receitas nem montar cache auxiliar para essa finalidade.
