-- queries/os/movimentadas.sql
-- OS que tiveram movimentação de etapa na data informada.
-- Uma linha por entrada em ordemservicocaixalog (pode haver > 1 por OS
-- se a OS passou por múltiplas etapas no mesmo dia).
-- Filtro por codEtapa é feito no service (evita SQL dinâmico no Firebird).
-- Parâmetros:
--   1) data (DATE)      — dia da movimentação (ex.: D-1)
--   2) codEmpresa (INT) — NULL = todas as lojas
--   3) codEmpresa (INT) — repetido (padrão IS NULL OR = ? do Firebird)

WITH itens_os AS (
    SELECT
        ocx.cod_ordemservicocaixa,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.descricaolente END) AS lente_od,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.descricaolente END) AS lente_oe,
        MAX(COALESCE(otoi_cte.descricaoarmacao, ocr_cte.descricaoarmacao))           AS armacao
    FROM ordemservicocaixa ocx
    LEFT JOIN otiljclientereceita ocr_cte
      ON ocr_cte.cod_clientereceita = ocx.cod_clientereceita
    LEFT JOIN otiljclientereceita_lente ocrl
      ON ocrl.cod_clientereceita = ocr_cte.cod_clientereceita
    LEFT JOIN otiordemservicootica otoi_cte
      ON otoi_cte.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
    WHERE ocx.cod_ordemservicocaixa IS NOT NULL
    GROUP BY ocx.cod_ordemservicocaixa
)

SELECT
    CAST(ocx.numeroordemservico AS VARCHAR(30))      AS os,
    ocx.cod_empresaorigem                            AS cod_empresa,
    pe.nome                                          AS empresa,
    l.cod_etapa                                      AS cod_etapa,
    CASE l.cod_etapa
        WHEN  0 THEN 'Etapa inicial'
        WHEN  1 THEN 'Ordem de serviço no estoque'
        WHEN  2 THEN 'Translado estoque -> laboratório'
        WHEN  3 THEN 'Ordem de serviço no laboratório'
        WHEN  4 THEN 'Translado laboratório -> loja'
        WHEN  5 THEN 'Ordem de serviço na loja'
        WHEN  6 THEN 'Venda concluída e serviço na loja'
        WHEN  7 THEN 'Translado loja (pós venda) -> estoque'
        WHEN  8 THEN 'Ordem de serviço entregue ao cliente'
        WHEN  9 THEN 'Ordem de serviço cancelada'
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
    END                                              AS etapa,
    CAST(l.datahoraentrada AS DATE)                  AS data_movimentacao,
    ocx.dataemissao                                  AS data_emissao,
    ocx.dataprevisao                                 AS data_previsao,
    COALESCE(otoi.nomepaciente, pc.nome)             AS cliente,
    CASE
        WHEN pc.cpf IS NULL THEN NULL
        ELSE RIGHT('00000000000' || TRIM(CAST(pc.cpf AS VARCHAR(20))), 11)
    END                                              AS cpf,
    CASE
        WHEN CHAR_LENGTH(REPLACE(pc.telefonecelular, '-', '')) < 4 THEN NULL
        WHEN pc.telefonecelular NOT LIKE '11%'
             AND CHAR_LENGTH(REPLACE(pc.telefonecelular, '-', '')) <= 9
             THEN '11' || REPLACE(pc.telefonecelular, '-', '')
        ELSE REPLACE(pc.telefonecelular, '-', '')
    END                                              AS telefone_celular,
    CASE
        WHEN COALESCE(pc.telefoneresidencial1, pc.telefonecomercial1) IS NULL THEN NULL
        WHEN COALESCE(pc.telefoneresidencial1, pc.telefonecomercial1) NOT LIKE '11%'
             AND CHAR_LENGTH(REPLACE(COALESCE(pc.telefoneresidencial1, pc.telefonecomercial1), '-', '')) <= 9
             THEN '11' || REPLACE(COALESCE(pc.telefoneresidencial1, pc.telefonecomercial1), '-', '')
        ELSE REPLACE(COALESCE(pc.telefoneresidencial1, pc.telefonecomercial1), '-', '')
    END                                              AS telefone_residencial,
    itens.lente_od                                   AS lente_od,
    itens.lente_oe                                   AS lente_oe,
    itens.armacao                                    AS armacao

FROM ordemservicocaixalog l
JOIN ordemservicocaixa ocx
  ON ocx.cod_ordemservicocaixa = l.cod_ordemservicocaixa
JOIN pessoa pe
  ON pe.cod_pessoa = ocx.cod_empresaorigem
JOIN pessoa pc
  ON pc.cod_pessoa = ocx.cod_cliente
LEFT JOIN otiordemservicootica otoi
  ON otoi.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN itens_os itens
  ON itens.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa

WHERE
    CAST(l.datahoraentrada AS DATE) = CAST(? AS DATE)
    AND ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )

ORDER BY pe.nome, l.datahoraentrada, ocx.numeroordemservico;
