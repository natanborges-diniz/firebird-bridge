# Contrato de Armação no Hub Receitas

Endpoint:
- `GET /api/v1/os/hub-receitas`

Campos adicionados para o frontend (Lovable):
- `cod_formato_aro`: código consolidado com fallback (`OTIORDEMSERVICOOTICA` -> `OTILJCLIENTERECEITA`)
- `otoi_cod_formatoaro`: código bruto em `OTIORDEMSERVICOOTICA`
- `ocr_cod_formatoaro`: código bruto em `OTILJCLIENTERECEITA`
- `descricao_armacao`: descrição consolidada da armação com fallback
- `referencia_armacao`: referência consolidada da armação com fallback

Regras de fallback:
- `cod_formato_aro = COALESCE(otoi.cod_formatoaro, ocr.cod_formatoaro)`
- `descricao_armacao = COALESCE(otoi.descricaoarmacao, ocr.descricaoarmacao)`
- `referencia_armacao = COALESCE(otoi.referencia, ocr.referencia)`

Sugestão de uso no frontend:
1. Exibir `descricao_armacao` como label principal da armação.
2. Exibir `referencia_armacao` como subtítulo/código.
3. Exibir `cod_formato_aro` quando houver necessidade de chave técnica/integridade.
4. Em caso de `null`, mostrar "Não informado" e evitar bloquear renderização.
