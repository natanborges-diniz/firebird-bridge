WITH ultlog AS (
    SELECT
        l.cod_ordemservicocaixa,
        MAX(l.datahoraentrada) AS max_datahoraentrada
    FROM ordemservicocaixalog l
    GROUP BY l.cod_ordemservicocaixa
)

SELECT
    CAST(ocx.numeroordemservico AS VARCHAR(30)) AS os,
    CASE l.cod_etapa
        WHEN 00 THEN 'Etapa inicial'
        WHEN 01 THEN 'Ordem de serviço no estoque'
        WHEN 02 THEN 'Translado estoque -> laboratório'
        WHEN 03 THEN 'Ordem de serviço no laboratório'
        WHEN 04 THEN 'Translado laboratório -> loja'
        WHEN 05 THEN 'Ordem de serviço na loja'
        WHEN 06 THEN 'Venda concluída e serviço na loja'
        WHEN 07 THEN 'Translado loja (pós venda) -> estoque'
        WHEN 08 THEN 'Ordem de serviço entregue ao cliente'
        WHEN 09 THEN 'Ordem de serviço cancelada'
        WHEN 10 THEN 'Aguardando compra de lentes'
        WHEN 11 THEN 'O.S. devolvida para tratamento'
        WHEN 12 THEN 'O.S. em tratamento externo'
        WHEN 13 THEN 'O.S. devolvida pelo cliente'
        WHEN 14 THEN 'Translado loja - estoque'
        WHEN 15 THEN 'Aguardando armação para montagem'
        WHEN 16 THEN 'Armação enviada pela loja para montagem'
        WHEN 17 THEN 'Serviço forçar finalização'
        WHEN 18 THEN 'Devolver para o laboratório'
        ELSE '<DESCONHECIDA>'
    END AS etapa,
    CASE
        WHEN l.cod_etapa = 8 THEN 'ENTREGUE'
        WHEN ocx.dataprevisao IS NULL THEN 'SEM_DATA'
        WHEN CURRENT_DATE <= ocx.dataprevisao THEN 'NO_PRAZO'
        WHEN DATEDIFF(DAY FROM ocx.dataprevisao TO CURRENT_DATE) BETWEEN 1 AND 7 THEN 'ATRASO_LEVE'
        ELSE 'ATRASO'
    END AS status_atraso,
    CASE
        WHEN ocx.dataprevisao IS NULL THEN NULL
        WHEN l.cod_etapa = 8 AND l.datahorasaida IS NOT NULL THEN
            IIF(
                CAST(l.datahorasaida AS DATE) <= ocx.dataprevisao,
                0,
                DATEDIFF(DAY FROM ocx.dataprevisao TO CAST(l.datahorasaida AS DATE))
            )
        WHEN CURRENT_DATE <= ocx.dataprevisao THEN 0
        ELSE DATEDIFF(DAY FROM ocx.dataprevisao TO CURRENT_DATE)
    END AS atraso_dias,
    ocx.dataprevisao AS data_previsao,
    ocx.dataemissao AS data_emissao,
    CAST(l.datahorasaida AS DATE) AS data_saida,
    pe.nome AS empresa,
    COALESCE(otoi.nomepaciente, pc.nome) AS cliente,
    pv.nome AS vendedor
FROM ordemservicocaixa ocx
JOIN pessoa pe ON pe.cod_pessoa = ocx.cod_empresaorigem
JOIN pessoa pc ON pc.cod_pessoa = ocx.cod_cliente
LEFT JOIN pessoa pv ON pv.cod_pessoa = ocx.cod_vendedor
LEFT JOIN otiordemservicootica otoi ON otoi.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
JOIN ultlog ul
  ON ul.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
JOIN ordemservicocaixalog l
  ON l.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
 AND l.datahoraentrada = ul.max_datahoraentrada
WHERE
    ( ? IS NULL OR ocx.numeroordemservico = CAST(? AS INTEGER) )
    AND ( ? IS NULL OR RIGHT('00000000000' || TRIM(CAST(pc.cpf AS VARCHAR(20))), 11) = ? )
    AND ( ? IS NULL OR ocx.dataemissao >= DATEADD(-180 DAY TO CURRENT_DATE) )
    AND ocx.cod_empresaorigem NOT IN (3, 5, 7, 8, 11, 12)
ORDER BY ocx.dataemissao DESC, ocx.numeroordemservico DESC;
