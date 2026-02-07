-- Queries de Diagnóstico
-- Execute estas queries para descobrir por que produtos não aparecem

-- ============================================================
-- 1. VERIFICAR SE COD_ORDEMSERVICOCAIXA TEM DADOS
-- ============================================================
-- Esta query mostra quantos registros em TRANSACAO_ITEM 
-- têm a coluna COD_ORDEMSERVICOCAIXA preenchida

SELECT 
    'Total de registros' AS metrica,
    COUNT(*) AS valor
FROM TRANSACAO_ITEM

UNION ALL

SELECT 
    'Com COD_ORDEMSERVICOCAIXA preenchido' AS metrica,
    COUNT(*) AS valor
FROM TRANSACAO_ITEM 
WHERE COD_ORDEMSERVICOCAIXA IS NOT NULL

UNION ALL

SELECT 
    'Com COD_ORDEMSERVICOCAIXA vazio (NULL)' AS metrica,
    COUNT(*) AS valor
FROM TRANSACAO_ITEM 
WHERE COD_ORDEMSERVICOCAIXA IS NULL;


-- ============================================================
-- 2. VERIFICAR PRODUTOS TIPO "LG%" (LENTES)
-- ============================================================
-- A query hub_receitas.sql busca produtos que começam com "LG%"
-- Vamos ver se existem e se estão vinculados com OS

SELECT 
    'Total de itens tipo LG%' AS metrica,
    COUNT(DISTINCT i.cod_item) AS valor
FROM ITEM i
WHERE i.descricao LIKE 'LG%'

UNION ALL

SELECT 
    'Itens LG% em TRANSACAO_ITEM' AS metrica,
    COUNT(DISTINCT ti.cod_item) AS valor
FROM TRANSACAO_ITEM ti
JOIN ITEM i ON i.cod_item = ti.cod_item
WHERE i.descricao LIKE 'LG%'

UNION ALL

SELECT 
    'Itens LG% com COD_ORDEMSERVICOCAIXA' AS metrica,
    COUNT(DISTINCT ti.cod_item) AS valor
FROM TRANSACAO_ITEM ti
JOIN ITEM i ON i.cod_item = ti.cod_item
WHERE i.descricao LIKE 'LG%'
  AND ti.cod_ordemservicocaixa IS NOT NULL;


-- ============================================================
-- 3. AMOSTRA DE DADOS
-- ============================================================
-- Mostra 10 exemplos de TRANSACAO_ITEM com produtos LG%

SELECT FIRST 10
    ti.cod_transacao,
    ti.cod_ordemservicocaixa,
    ti.cod_item,
    i.descricao AS produto_descricao,
    ocx.numeroordemservico AS os_numero,
    ocx.dataemissao AS os_data
FROM TRANSACAO_ITEM ti
JOIN ITEM i ON i.cod_item = ti.cod_item
LEFT JOIN ORDEMSERVICOCAIXA ocx ON ocx.cod_ordemservicocaixa = ti.cod_ordemservicocaixa
WHERE i.descricao LIKE 'LG%'
  AND ti.cod_ordemservicocaixa IS NOT NULL
ORDER BY ocx.dataemissao DESC;


-- ============================================================
-- 4. VERIFICAR SE A CTE itens_lente RETORNA DADOS
-- ============================================================
-- Esta é a CTE usada na query hub_receitas.sql

SELECT 
    ti.cod_ordemservicocaixa,
    MIN(i.descricao) AS lente_descricao,
    COUNT(*) AS qtd_itens
FROM TRANSACAO_ITEM ti
JOIN ITEM i ON i.cod_item = ti.cod_item
WHERE i.descricao LIKE 'LG%'
  AND ti.cod_ordemservicocaixa IS NOT NULL
GROUP BY ti.cod_ordemservicocaixa
ORDER BY ti.cod_ordemservicocaixa DESC
ROWS 20;


-- ============================================================
-- 5. VERIFICAR ORDENS DE SERVIÇO RECENTES
-- ============================================================
-- Mostra OS dos últimos 30 dias e se têm produtos vinculados

SELECT 
    ocx.cod_ordemservicocaixa,
    ocx.numeroordemservico,
    ocx.dataemissao,
    ocx.cod_empresaorigem AS empresa,
    pc.nome AS cliente,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM TRANSACAO_ITEM ti
            JOIN ITEM i ON i.cod_item = ti.cod_item
            WHERE ti.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
              AND i.descricao LIKE 'LG%'
        ) THEN 'SIM'
        ELSE 'NAO'
    END AS tem_produto_lg
FROM ORDEMSERVICOCAIXA ocx
JOIN PESSOA pc ON pc.cod_pessoa = ocx.cod_cliente
WHERE ocx.dataemissao >= CURRENT_DATE - 30
ORDER BY ocx.dataemissao DESC
ROWS 20;


-- ============================================================
-- 6. TESTE COMPLETO DO HUB_RECEITAS (SIMPLIFICADO)
-- ============================================================
-- Versão simplificada da query hub_receitas.sql para testar
-- Ajuste as datas conforme necessário

WITH itens_lente AS (
    SELECT
        ti.cod_ordemservicocaixa,
        MIN(i.descricao) AS lente_descricao
    FROM transacao_item ti
    JOIN item i ON i.cod_item = ti.cod_item
    WHERE i.descricao LIKE 'LG%'
    GROUP BY ti.cod_ordemservicocaixa
)
SELECT 
    ocx.cod_ordemservicocaixa,
    ocx.numeroordemservico,
    ocx.dataemissao,
    lensitems.lente_descricao
FROM ordemservicocaixa ocx
LEFT JOIN itens_lente lensitems
  ON lensitems.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
WHERE ocx.dataemissao >= CURRENT_DATE - 30
  -- Adicione filtros de empresa se necessário:
  -- AND ocx.cod_empresaorigem = 1
ORDER BY ocx.dataemissao DESC
ROWS 20;


-- ============================================================
-- 7. DESCOBRIR PADRÕES DE DESCRIÇÃO DE PRODUTOS
-- ============================================================
-- Se produtos não começam com "LG%", descubra o padrão real

SELECT FIRST 50
    LEFT(i.descricao, 4) AS prefixo,
    COUNT(*) AS quantidade,
    MIN(i.descricao) AS exemplo
FROM TRANSACAO_ITEM ti
JOIN ITEM i ON i.cod_item = ti.cod_item
WHERE ti.cod_ordemservicocaixa IS NOT NULL
GROUP BY LEFT(i.descricao, 4)
ORDER BY COUNT(*) DESC;


-- ============================================================
-- INTERPRETAÇÃO DOS RESULTADOS
-- ============================================================

/*
RESULTADO DA QUERY 1:
- Se "Com COD_ORDEMSERVICOCAIXA preenchido" = 0 ou muito baixo
  → Problema: Coluna existe mas não tem dados
  → Solução: Verificar processo de inserção de dados

RESULTADO DA QUERY 2:
- Se "Total de itens tipo LG%" = 0
  → Problema: Não existem produtos com prefixo "LG%"
  → Solução: Use a query 7 para descobrir o padrão real
  
- Se "Itens LG% com COD_ORDEMSERVICOCAIXA" = 0
  → Problema: Produtos LG% existem mas não estão vinculados com OS
  → Solução: Verificar processo de vínculo

RESULTADO DA QUERY 3:
- Se não retorna nenhum registro
  → Confirma que não há produtos LG% vinculados com OS
  
- Se retorna registros
  → Ótimo! Produtos existem e estão vinculados

RESULTADO DA QUERY 4:
- Se não retorna nenhum registro
  → A CTE itens_lente está vazia
  → Por isso produtos não aparecem no hub_receitas
  
- Se retorna registros
  → CTE funciona! Problema pode ser no join ou filtros

RESULTADO DA QUERY 5:
- Mostra quais OS têm ou não têm produtos LG%
- Se coluna "tem_produto_lg" = "NAO" para todas
  → Confirma que produtos não estão vinculados

RESULTADO DA QUERY 6:
- Teste direto da lógica do hub_receitas
- Se lente_descricao vem NULL
  → Confirma o problema: join não encontra produtos
  
- Se lente_descricao vem preenchida
  → Join funciona! Problema pode ser em outra parte da query

RESULTADO DA QUERY 7:
- Descobre quais são os prefixos reais dos produtos
- Se produtos não começam com "LG%", ajuste o WHERE
- Exemplo: podem começar com "LENT", "PROD", etc.
*/
