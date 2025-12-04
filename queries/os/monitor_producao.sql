-- queries/os/monitor_producao.sql
-- Monitor de Produção - Ordens de Serviço (OS) por etapa, com dados de cliente, empresa, produtos e telefone
-- Filtros: data de emissão (intervalo)

with    
    tbordemcompra as (
        select
            ordemcompra_transacaoitem.cod_ordemservicocaixa AS cod_ordemservicocaixa,
            list(distinct ordemcompra.numeroordemcompra, ', ') oc
        from
            transacao
                join ordemcompra
                    on (ordemcompra.cod_empresa = transacao.cod_empresa
                        and ordemcompra.cod_ordemcompra = transacao.cod_transacao)
                join ordemcompra_transacaoitem
                    on (ORDEMCOMPRA_TRANSACAOITEM.COD_EMPRESA = ORDEMCOMPRA.cod_empresa
                        and ORDEMCOMPRA_TRANSACAOITEM.COD_ORDEMCOMPRA = ORDEMCOMPRA.cod_ordemcompra)
        group BY 1
    ) ,
    tbitensservico as ( 
        SELECT 	
            oc.NUMEROORDEMSERVICO,
            List(i.DESCRICAO) AS DESCRICAO_LISTA
        FROM	
            ORDEMSERVICOCAIXA oc 
            INNER JOIN TRANSACAO_ITEM ti ON oc.COD_TRANSACAO  = ti.COD_TRANSACAO
            INNER JOIN item i ON i.cod_item = ti.COD_ITEM
        GROUP BY 
            oc.NUMEROORDEMSERVICO 
    )
SELECT	 
	tt.DESCRICAO_LISTA AS PRODUTOS,
    ordemservicocaixa.numeroordemservico AS OS,
    ordemservicocaixa.Total,
    pessoaempresa.nome AS EMPRESA,
    ordemservicocaixa.dataemissao AS DATAEMISSAO,
    ordemservicocaixa.dataprevisao AS DATAPREVISAO,
    pessoacliente.nome AS CLIENTE,
    pessoacliente.cod_pessoa AS CODCLIENTE, 
    case ordemservicocaixalog.cod_etapa
        when 00 then 'Etapa inicial'
        when 01 then 'Ordem de serviço no estoque'
        when 02 then 'Translado estoque -> laboratório'
        when 03 then 'Ordem de serviço no laboratório'
        when 04 then 'Translado laboratório -> loja'
        when 05 then 'Ordem de serviço na loja'
        when 06 then 'Venda concluída e serviço na loja'
        when 07 then 'Translado loja (pós venda) -> estoque'
        when 08 then 'Ordem de serviço entregue ao cliente'
        when 09 then 'Ordem de serviço cancelada'
        when 10 then 'Aguardando compra de lentes'
        when 11 then 'O.S. devolvida para tratamento'
        when 12 then 'O.S. em tratamento externo'
        when 13 then 'O.S. devolvida pelo cliente'
        when 14 then 'Translado loja - estoque'
        when 15 then 'Aguardando armação para montagem'
        when 16 then 'Armação enviada pela loja para montagem'
        when 17 then 'Serviço forçar finalização'
        when 18 then 'Devolver para o laboratório'
    else
        '<DESCONHECIDA>'
    end AS ETAPA,
    usuario.username AS USUARIO,
    ordemservicocaixalog.datahoraentrada AS DATAHORAENTRADA,
    ordemservicocaixalog.datahorasaida AS DATAHORASAIDA,
    tbordemcompra.OC,
	pessoacliente.CPF AS CPF,
	CASE 
        WHEN pessoaempresa.nome = 'DINIZ PRIMITIVA I' THEN 595
        WHEN pessoaempresa.nome = 'DINIZ PRIMITIVA II' THEN 597
        WHEN pessoaempresa.nome = 'DINIZ ANTONIO AGU' THEN 599
        WHEN pessoaempresa.nome = 'DINIZ STO ANTONIO' THEN 705
        WHEN pessoaempresa.nome = 'DINIZ UNIAO' THEN 601
        WHEN pessoaempresa.nome = 'DINIZ SUPER' THEN 603
        WHEN pessoaempresa.nome = 'DINIZ CARAPICUIBA' THEN 605
        WHEN pessoaempresa.nome = 'DINIZ ITAPEVI' THEN 607
        WHEN pessoaempresa.nome = 'DINIZ JANDIRA' THEN 609
        WHEN pessoaempresa.nome = 'DINIZ BARUERI' THEN 769
        ELSE 0
    END AS CODEMPRESA,
	COALESCE( 
        CASE  
            WHEN CHAR_LENGTH(REPLACE(pessoacliente.telefonecelular,'-','')) < 4 THEN null
            WHEN pessoacliente.telefonecelular NOT LIKE '11%' 
                 AND CHAR_LENGTH(REPLACE(pessoacliente.telefonecelular,'-','')) <= 9 
                 THEN '11' || REPLACE(pessoacliente.telefonecelular,'-','')
            ELSE REPLACE(pessoacliente.telefonecelular,'-','')
        END,
        CASE  
            WHEN coalesce(pessoacliente.telefoneresidencial1, pessoacliente.telefonecomercial1) NOT LIKE '11%' 
                 AND CHAR_LENGTH(REPLACE(coalesce(pessoacliente.telefoneresidencial1, pessoacliente.telefonecomercial1),'-','')) <= 9 
                 THEN '11' || REPLACE(coalesce(pessoacliente.telefoneresidencial1, pessoacliente.telefonecomercial1),'-','')
            ELSE REPLACE(coalesce(pessoacliente.telefoneresidencial1, pessoacliente.telefonecomercial1),'-','') 
        END
    )  AS TELEFONE
from
    ordemservicocaixa
        join pessoa pessoaempresa
            on (pessoaempresa.cod_pessoa = ordemservicocaixa.cod_empresaorigem)
        join pessoa pessoacliente
            on (pessoacliente.cod_pessoa = ordemservicocaixa.cod_cliente)
        join ordemservicocaixalog
            on (ordemservicocaixalog.cod_ordemservicocaixa = ordemservicocaixa.cod_ordemservicocaixa)
        join usuario
            on (usuario.cod_usuario = ordemservicocaixalog.cod_usuario)
        left join tbordemcompra  
           on (tbordemcompra.cod_ordemservicocaixa = ordemservicocaixa.cod_ordemservicocaixa)
        LEFT JOIN tbitensservico tt 
           ON tt.NUMEROORDEMSERVICO = ordemservicocaixa.NUMEROORDEMSERVICO
WHERE  
    ordemservicocaixa.dataemissao 
        BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
ORDER BY
    pessoaempresa.nome,
    ordemservicocaixa.dataemissao,
    ordemservicocaixa.numeroordemservico;
