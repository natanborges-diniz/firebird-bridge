-- queries/os/monitor_ultima_etapa.sql
WITH
    tbordemcompra AS (
        SELECT
            ordemcompra_transacaoitem.cod_ordemservicocaixa AS cod_ordemservicocaixa,
            LIST(DISTINCT ordemcompra.numeroordemcompra, ', ') AS oc
        FROM transacao
        JOIN ordemcompra
          ON (ordemcompra.cod_empresa = transacao.cod_empresa
              AND ordemcompra.cod_ordemcompra = transacao.cod_transacao)
        JOIN ordemcompra_transacaoitem
          ON (ordemcompra_transacaoitem.cod_empresa = ordemcompra.cod_empresa
              AND ordemcompra_transacaoitem.cod_ordemcompra = ordemcompra.cod_ordemcompra)
        GROUP BY 1
    ),

    tbitensservico AS (
        SELECT
            oc.numeroordemservico,
            LIST(i.descricao) AS descricao_lista
        FROM ordemservicocaixa oc
        INNER JOIN transacao_item ti
          ON oc.cod_transacao = ti.cod_transacao
        INNER JOIN item i
          ON i.cod_item = ti.cod_item
        GROUP BY oc.numeroordemservico
    ),

    ultlog AS (
        SELECT
            l.cod_ordemservicocaixa,
            MAX(l.datahoraentrada) AS max_datahoraentrada
        FROM ordemservicocaixalog l
        GROUP BY l.cod_ordemservicocaixa
    )

SELECT
    tt.descricao_lista                             AS produtos,
    ocx.cod_ordemservicocaixa                      AS cod_os,
    ocx.numeroordemservico                         AS os,
    ocx.total                                      AS total,

    pe.nome                                        AS empresa,
    ocx.cod_empresaorigem                          AS cod_empresa_origem,

    ocx.dataemissao                                AS dataemissao,
    ocx.dataprevisao                               AS dataprevisao,

    pc.nome                                        AS cliente,
    pc.cod_pessoa                                  AS codcliente,
    pc.cpf                                        AS cpf,
    pc.datanascimento                              AS data_nascimento,
    COALESCE(otoi.nomepaciente, pc.nome)          AS paciente,
    pv.nome                                        AS vendedor,

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

    u.username                                     AS usuario,
    l.datahoraentrada                              AS datahoraentrada,
    l.datahorasaida                                AS datahorasaida,

    tbordemcompra.oc                               AS ordemcompra,

    CASE
        WHEN pe.nome = 'DINIZ PRIMITIVA I'  THEN 595
        WHEN pe.nome = 'DINIZ PRIMITIVA II' THEN 597
        WHEN pe.nome = 'DINIZ ANTONIO AGU'  THEN 599
        WHEN pe.nome = 'DINIZ STO ANTONIO'  THEN 705
        WHEN pe.nome = 'DINIZ UNIAO'        THEN 601
        WHEN pe.nome = 'DINIZ SUPER'        THEN 603
        WHEN pe.nome = 'DINIZ CARAPICUIBA'  THEN 605
        WHEN pe.nome = 'DINIZ ITAPEVI'      THEN 607
        WHEN pe.nome = 'DINIZ JANDIRA'      THEN 609
        WHEN pe.nome = 'DINIZ BARUERI'      THEN 769
        ELSE 0
    END AS codempresa,

    COALESCE(
        CASE
            WHEN CHAR_LENGTH(REPLACE(pc.telefonecelular,'-','')) < 4 THEN NULL
            WHEN pc.telefonecelular NOT LIKE '11%'
                 AND CHAR_LENGTH(REPLACE(pc.telefonecelular,'-','')) <= 9
                 THEN '11' || REPLACE(pc.telefonecelular,'-','')
            ELSE REPLACE(pc.telefonecelular,'-','')
        END,
        CASE
            WHEN COALESCE(pc.telefoneresidencial1, pc.telefonecomercial1) NOT LIKE '11%'
                 AND CHAR_LENGTH(REPLACE(COALESCE(pc.telefoneresidencial1, pc.telefonecomercial1),'-','')) <= 9
                 THEN '11' || REPLACE(COALESCE(pc.telefoneresidencial1, pc.telefonecomercial1),'-','')
            ELSE REPLACE(COALESCE(pc.telefoneresidencial1, pc.telefonecomercial1),'-','')
        END
    ) AS telefone,

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

    CASE
        WHEN l.cod_etapa = 8 THEN 'ENTREGUE'
        WHEN ocx.dataprevisao IS NULL THEN 'SEM_DATA'
        WHEN CURRENT_DATE <= ocx.dataprevisao THEN 'NO_PRAZO'
        WHEN DATEDIFF(DAY FROM ocx.dataprevisao TO CURRENT_DATE) BETWEEN 1 AND 7 THEN 'ATRASO_LEVE'
        ELSE 'ATRASO'
    END AS status_atraso

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

JOIN usuario u ON u.cod_usuario = l.cod_usuario

LEFT JOIN tbordemcompra ON tbordemcompra.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN tbitensservico tt ON tt.numeroordemservico = ocx.numeroordemservico

WHERE
    ocx.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
    AND ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )

ORDER BY pe.nome, ocx.dataemissao, ocx.numeroordemservico;
