# Monitor Última Etapa — atualização de performance

## Contexto
Por solicitação do frontend, o endpoint de monitor principal deve trazer apenas dados de produção para listagem, sem cálculos extras de receita/foto em massa.

## Endpoint
- `GET /api/v1/os/monitor-ultima-etapa`

## Mudança aplicada
- O campo calculado `tem_receita` foi removido da query de monitor para reduzir custo de execução em períodos amplos (ex.: 1 mês, todas as empresas).
- A query voltou para o padrão com seleção da última etapa por `MAX(datahoraentrada)` em CTE dedicada (`ultlog`), que tende a ser mais eficiente.

## Campos complementares no payload
- `cpf`: `PESSOA.IDENTIFICADOR` do cliente
- `data_nascimento`: `PESSOA.DATANASCIMENTO` do cliente
- `paciente`: `OTIORDEMSERVICOOTICA.NOMEPACIENTE` com fallback para `PESSOA.NOME`

> Observação: não usamos `ORDEMSERVICO.PACIENTE` porque essa coluna não existe em algumas bases Firebird e causava erro SQL `Column unknown`.

## Fluxo recomendado
1. Carregar lista pelo monitor: `/api/v1/os/monitor-ultima-etapa`.
2. Ao abrir OS específica, consultar detalhes em `/api/v1/os/hub-receitas`.

## Benefício
- Menos subconsultas por linha no monitor.
- Melhor tempo de resposta para filtros amplos.
