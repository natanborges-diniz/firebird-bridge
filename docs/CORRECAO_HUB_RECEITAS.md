# Correção da Query hub_receitas.sql - Dioptrias e Produtos por Olho

## Problema Identificado

A query do endpoint `/os/hub-receitas` estava retornando dados incorretos para:

1. **Dioptrias (valores de prescrição)**: Estava exibindo dados do cadastro geral do cliente em vez dos dados específicos da OS
2. **Produtos (lentes OD/OE)**: Ambos os olhos mostravam a mesma descrição de produto

## Causa Raiz

### 1. Dioptrias - Fallback Incorreto

**Antes (linhas 70-88):**
```sql
-- OD e OE caindo para os mesmos campos do cliente (ocrl)
COALESCE(osl.od_longe_esf, ocrl.longe_esf) AS od_longe_esf,
COALESCE(osl.oe_longe_esf, ocrl.longe_esf) AS oe_longe_esf, -- ERRADO!
```

Problema: O fallback para OE usava os mesmos campos de `ocrl` que OD, então quando a OS não tinha dados específicos, ambos os olhos mostravam os mesmos valores (do olho direito do cadastro do cliente).

**Depois (linhas 86-107):**
```sql
-- Removido o fallback - usa APENAS dados da OS (osl)
osl.od_longe_esf AS od_longe_esf,
osl.oe_longe_esf AS oe_longe_esf,
```

Solução: Removemos o COALESCE e agora retornamos APENAS os dados da tabela `ordemservicooticalente` (alias `osl`), que contém os dados específicos da OS por olho. Se a OS não tiver dados, retornará NULL, e o frontend (que já tem fallback implementado) decidirá o que fazer.

### 2. Produtos - Sem Separação por Olho

**Antes (linhas 26-35, 102-103):**
```sql
-- CTE agrupava todas as lentes juntas
itens_lente AS (
    SELECT
        ti.cod_ordemservicocaixa,
        MIN(i.descricao) AS lente_descricao  -- Uma só descrição
    FROM transacao_item ti
    ...
)

-- Ambos os olhos usavam o mesmo valor
lensitems.lente_descricao AS lente_od_descricao,
lensitems.lente_descricao AS lente_oe_descricao,
```

Problema: A CTE `itens_lente` agrupava todas as lentes e retornava apenas uma descrição (MIN). Isso fazia com que ambos os olhos mostrassem o mesmo produto.

**Depois (linhas 26-52, 121-122):**
```sql
-- CTE agora separa OD e OE
itens_lente AS (
    SELECT
        ti.cod_ordemservicocaixa,
        -- Primeira lente (OD)
        (SELECT FIRST 1 i2.descricao 
         FROM transacao_item ti2 
         JOIN item i2 ON i2.cod_item = ti2.cod_item
         WHERE ti2.cod_ordemservicocaixa = ti.cod_ordemservicocaixa
           AND i2.descricao LIKE 'LG%'
         ORDER BY COALESCE(ti2.sequencia, 999), ti2.cod_transacao_item) AS lente_od_descricao,
        -- Segunda lente (OE)
        (SELECT FIRST 1 SKIP 1 i2.descricao ...) AS lente_oe_descricao
    ...
)

-- Agora usa campos separados
lensitems.lente_od_descricao AS lente_od_descricao,
lensitems.lente_oe_descricao AS lente_oe_descricao,
```

Solução: Modificamos a CTE para buscar separadamente:
- Primeira lente (OD) ordenada por sequência ou ordem de inserção
- Segunda lente (OE) usando SKIP 1

## Impacto das Mudanças

### Frontend Preparado

O frontend (Lovable) já tem fallback implementado em `src/services/osHubService.ts`:
- Usa `cliente_*` fields quando campos da OS estão NULL
- Portanto, remover o COALESCE no backend não quebra nada
- Agora o frontend receberá dados corretos e decidirá quando usar fallback

### Dados Mais Precisos

1. **Dioptrias**: Sempre refletirão a prescrição específica daquela OS
2. **Produtos**: Cada olho terá seu produto correto (OD ≠ OE)

## Validação

Para validar com uma OS específica (ex: 89798):

```bash
curl "http://seu-servidor/api/v1/os/hub-receitas?dataInicio=2024-01-01&dataFim=2024-12-31&os=89798"
```

Verificar:
1. `od_longe_esf` ≠ `oe_longe_esf` (se os valores forem diferentes)
2. `lente_od_descricao` ≠ `lente_oe_descricao` (se houver duas lentes diferentes)

## Arquivos Modificados

- `queries/os/hub_receitas.sql` - Query principal corrigida
- `docs/CORRECAO_HUB_RECEITAS.md` - Esta documentação

## Notas Técnicas

### Sobre o Campo `sequencia`

A query usa `COALESCE(ti2.sequencia, 999)` para ordenação:
- Se `sequencia` existe e é populado (1, 2, etc), usa esse valor
- Se `sequencia` é NULL, usa 999 (vai para o final)
- Depois ordena por `cod_transacao_item` como segundo critério

Isso garante que:
- Sistemas que usam `sequencia` terão produtos na ordem correta
- Sistemas que não usam terão produtos ordenados por ordem de inserção

### Remoção do JOIN com `ocrl`

O JOIN com `otiljclientereceita_lente` (alias `ocrl`) ainda existe na query (linha 149-150) mas não é mais usado nos campos de dioptria. Pode ser removido futuramente se confirmado que não é necessário para outros campos.

## Próximos Passos

1. ✅ Testar com OS conhecida (89798)
2. ✅ Comparar com dados do ERP
3. ✅ Validar no frontend que dados aparecem corretos
4. 🔄 Monitorar logs por alguns dias
5. 🔄 Remover JOIN `ocrl` se confirmado não necessário
