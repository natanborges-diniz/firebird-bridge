-- Query para investigar como produtos são vinculados a olhos (OD/OE)
-- Executar essa query no Firebird para entender a estrutura

-- 1. Ver campos disponíveis em TRANSACAO_ITEM
SELECT FIRST 1
    ti.*
FROM TRANSACAO_ITEM ti
WHERE ti.cod_ordemservicocaixa IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM ITEM i 
      WHERE i.cod_item = ti.cod_item 
        AND i.descricao LIKE 'LG%'
  );

-- 2. Ver se TRANSACAO_ITEM tem campo de observação/complemento que indica olho
SELECT FIRST 10
    ti.cod_transacao,
    ti.cod_ordemservicocaixa,
    ti.cod_item,
    i.descricao,
    ti.observacao,
    ti.complemento
FROM TRANSACAO_ITEM ti
JOIN ITEM i ON i.cod_item = ti.cod_item
WHERE ti.cod_ordemservicocaixa IS NOT NULL
  AND i.descricao LIKE 'LG%'
ORDER BY ti.cod_transacao DESC;

-- 3. Ver se existe campo indicando posição/olho
SELECT FIRST 5
    *
FROM RDB$RELATION_FIELDS
WHERE RDB$RELATION_NAME = 'TRANSACAO_ITEM'
  AND (
    UPPER(RDB$FIELD_NAME) LIKE '%OLHO%'
    OR UPPER(RDB$FIELD_NAME) LIKE '%EYE%'
    OR UPPER(RDB$FIELD_NAME) LIKE '%POSICAO%'
    OR UPPER(RDB$FIELD_NAME) LIKE '%POSITION%'
    OR UPPER(RDB$FIELD_NAME) LIKE '%LADO%'
  );

-- 4. Ver estrutura da tabela ORDEMSERVICOOTICALENTE (que tem OD/OE)
SELECT FIRST 1
    osl.*
FROM ORDEMSERVICOOTICALENTE osl
WHERE osl.cod_transacao IS NOT NULL;

-- 5. Ver estrutura da tabela OTILJCLIENTERECEITA_LENTE (cliente receita lente)
SELECT FIRST 1
    ocrl.*
FROM OTILJCLIENTERECEITA_LENTE ocrl;

-- 6. Verificar se os produtos têm descrição indicando olho (OD/OE/DIR/ESQ)
SELECT FIRST 20
    i.cod_item,
    i.descricao,
    COUNT(DISTINCT ti.cod_ordemservicocaixa) AS qtd_os
FROM ITEM i
JOIN TRANSACAO_ITEM ti ON ti.cod_item = i.cod_item
WHERE i.descricao LIKE 'LG%'
  AND ti.cod_ordemservicocaixa IS NOT NULL
GROUP BY i.cod_item, i.descricao
ORDER BY COUNT(DISTINCT ti.cod_ordemservicocaixa) DESC;
