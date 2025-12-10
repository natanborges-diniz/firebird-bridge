-- queries/os/monitor.sql
-- Monitor de Produção - Ordens de Serviço (OS) por etapa, com dados de cliente, empresa, produtos e telefone
-- Filtros (via bridge):
--   ? = dataInicio (YYYY-MM-DD)
--   ? = dataFim    (YYYY-MM-DD)
--   ? = codEmpresa (opcional, pode ser NULL)
--   ? = codEmpresa (repetido para comparação)

WITH    
    tbordemcompra AS (
        SELECT
            ordemcompra_transacaoitem.cod_ordemservicocaixa AS cod_ordemservicocaixa,
            LIST(DISTINCT ordemcompra.numeroordemcompra, ', ') AS oc
        FROM
            transacao
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
        FROM	
            ordemservicocaixa oc 
            INNER JOIN transacao_item ti
                ON oc.cod_transacao = ti.cod_transacao
            INNER JOIN item i
                ON i.cod_item = ti.cod_item
        GROUP BY 
            oc.numeroordemservico
    )

SELECT	 
    -- produtos / itens
    tt.descricao_lista                             AS produtos,

    -- identificação OS
    ordemservicocaixa.cod_ordemservicocaixa        AS cod_os,
    ordemservicocaixa.numeroordemservico           AS os,
    ordemservicocaixa.total                        AS total,

    -- empresa
    pessoaempresa.nome                             AS empresa,
    ordemservicocaixa.cod_empresaorigem            AS cod_empresa_origem,

    -- datas principais
    ordemservicocaixa.dataemissao                  AS dataemissao,
    ordemservicocaixa.dataprevisao                 AS dataprevisao,

    -- cliente
    pessoacliente.nome                             AS cliente,
    pessoacliente.cod_pessoa                       AS codcliente, 
    pessoacliente.cpf                              AS cpf,

    -- etapa textual
    CASE ordemservicocaixalog.cod_etapa
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
    END                                             AS etapa,

    -- usuário e log
    usuario.username                               AS usuario,
    ordemservicocaixalog.datahoraentrada           AS datahoraentrada,
    ordemservicocaixalog.datahorasaida             AS datahorasaida,

    -- ordem de compra relacionada
    tbordemcompra.oc                               AS ordemcompra,

    -- código lógico da empresa (mapeamento atual que você já usava)
    CASE 
        WHEN pessoaempresa.nome = 'DINIZ PRIMITIVA I'  THEN 595
        WHEN pessoaempresa.nome = 'DINIZ PRIMITIVA II' THEN 597
        WHEN pessoaempresa.nome = 'DINIZ ANTONIO AGU'  THEN 599
        WHEN pessoaempresa.nome = 'DINIZ STO ANTONIO'  THEN 705
        WHEN pessoaempresa.nome = 'DINIZ UNIAO'        THEN 601
        WHEN pessoaempresa.nome = 'DINIZ SUPER'        THEN 603
        WHEN pessoaempresa.nome = 'DINIZ CARAPICUIBA'  THEN 605
        WHEN pessoaempresa.nome = 'DINIZ ITAPEVI'      THEN 607
        WHEN pessoaempresa.nome = 'DINIZ JANDIRA'      THEN 609
        WHEN pessoaempresa.nome = 'DINIZ BARUERI'      THEN 769
        ELSE 0
    END                                             AS codempresa,

    -- telefone já higienizado
    COALESCE( 
        CASE  
            WHEN CHAR_LENGTH(REPLACE(pessoacliente.telefonecelular,'-','')) < 4 THEN NULL
            WHEN pessoacliente.telefonecelular NOT LIKE '11%' 
                 AND CHAR_LENGTH(REPLACE(pessoacliente.telefonecelular,'-','')) <= 9 
                 THEN '11' || REPLACE(pessoacliente.telefonecelular,'-','')
            ELSE REPLACE(pessoacliente.telefonecelular,'-','')
        END,
        CASE  
            WHEN COALESCE(pessoacliente.telefoneresidencial1, pessoacliente.telefonecomercial1) NOT LIKE '11%' 
                 AND CHAR_LENGTH(REPLACE(COALESCE(pessoacliente.telefoneresidencial1, pessoacliente.telefonecomercial1),'-','')) <= 9 
                 THEN '11' || REPLACE(COALESCE(pessoacliente.telefoneresidencial1, pessoacliente.telefonecomercial1),'-','')
            ELSE REPLACE(COALESCE(pessoacliente.telefoneresidencial1, pessoacliente.telefonecomercial1),'-','') 
        END
    )                                               AS telefone,

    -------------------------------------------------------------------
    -- CÁLCULO DE ATRASO E STATUS (ISSUE 07)
    -------------------------------------------------------------------
    -- atraso em dias:
    --  - se etapa 8 (entregue): com base na datahorasaida x dataprevisao
    --  - senão: dataprevisao x data atual
    CASE
        WHEN ordemservicocaixa.dataprevisao IS NULL THEN NULL
        WHEN ordemservicocaixalog.cod_etapa = 8
             AND ordemservicocaixalog.datahorasaida IS NOT NULL THEN
             IIF(
                 CAST(ordemservicocaixalog.datahorasaida AS DATE) <= ordemservicocaixa.dataprevisao,
                 0,
                 DATEDIFF(DAY FROM ordemservicocaixa.dataprevisao TO CAST(ordemservicocaixalog.datahorasaida AS DATE))
             )
        WHEN CURRENT_DATE <= ordemservicocaixa.dataprevisao THEN 0
        ELSE
             DATEDIFF(DAY FROM ordemservicocaixa.dataprevisao TO CURRENT_DATE)
    END                                             AS atraso_dias,

    -- status de atraso consolidado
    CASE
        WHEN ordemservicocaixalog.cod_etapa = 8 THEN 'ENTREGUE'
        WHEN ordemservicocaixa.dataprevisao IS NULL THEN 'SEM_DATA'
        WHEN CURRENT_DATE <= ordemservicocaixa.dataprevisao THEN 'NO_PRAZO'
        WHEN DATEDIFF(DAY FROM ordemservicocaixa.dataprevisao TO CURRENT_DATE) BETWEEN 1 AND 7 THEN 'ATRASO_LEVE'
        ELSE 'ATRASO'
    END                                             AS status_atraso

FROM
    ordemservicocaixa
        JOIN pessoa pessoaempresa
            ON (pessoaempresa.cod_pessoa = ordemservicocaixa.cod_empresaorigem)
        JOIN pessoa pessoacliente
            ON (pessoacliente.cod_pessoa = ordemservicocaixa.cod_cliente)
        JOIN ordemservicocaixalog
            ON (ordemservicocaixalog.cod_ordemservicocaixa = ordemservicocaixa.cod_ordemservicocaixa)
        JOIN usuario
            ON (usuario.cod_usuario = ordemservicocaixalog.cod_usuario)
        LEFT JOIN tbordemcompra  
           ON (tbordemcompra.cod_ordemservicocaixa = ordemservicocaixa.cod_ordemservicocaixa)
        LEFT JOIN tbitensservico tt 
           ON tt.numeroordemservico = ordemservicocaixa.numeroordemservico
WHERE  
    ordemservicocaixa.dataemissao 
        BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
    AND ( ? IS NULL OR ordemservicocaixa.cod_empresaorigem = CAST(? AS INTEGER) )

ORDER BY
    pessoaempresa.nome,
    ordemservicocaixa.dataemissao,
    ordemservicocaixa.numeroordemservico;
