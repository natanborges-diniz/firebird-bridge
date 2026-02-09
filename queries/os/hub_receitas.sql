-- queries/os/hub_receitas.sql
-- Hub de OS + receita + imagens (filtros por data e empresa)

WITH itens_lente AS (
    SELECT
        ranked.cod_ordemservicocaixa,
        MAX(CASE 
            WHEN rn = 1 THEN ranked.descricao 
            ELSE NULL 
        END) AS lente_od_descricao,
        MAX(CASE 
            WHEN rn = 2 THEN ranked.descricao 
            ELSE NULL 
        END) AS lente_oe_descricao
    FROM (
        SELECT
            ocx.cod_ordemservicocaixa,
            i.descricao,
            ROW_NUMBER() OVER (
                PARTITION BY ocx.cod_ordemservicocaixa 
                ORDER BY ti.cod_transacaoitem
            ) AS rn
        FROM transacao_item ti
        JOIN ordemservicocaixa ocx
          ON ocx.cod_transacao = ti.cod_transacao
        JOIN item i ON i.cod_item = ti.cod_item
        JOIN produto p ON p.cod_produto = i.cod_item
        JOIN otiprodutolente l ON l.cod_produtolente = p.cod_produto
        WHERE ocx.cod_ordemservicocaixa IS NOT NULL
    ) ranked
    GROUP BY ranked.cod_ordemservicocaixa
),
receita_lente_cliente AS (
    SELECT
        ocrl.cod_clientereceita,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.longe_esf END) AS oe_longe_esf,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.longe_cil END) AS oe_longe_cil,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.longe_eixo END) AS oe_longe_eixo,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.perto_esf END) AS oe_perto_esf,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.perto_cil END) AS oe_perto_cil,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.perto_eixo END) AS oe_perto_eixo,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.dnp END) AS oe_dnp,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.perto_dnp END) AS oe_perto_dnp,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.alt END) AS oe_alt,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.adicao END) AS oe_adicao,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.lcdiametro END) AS oe_lcdiametro,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.cro END) AS oe_cro,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.cod_produtolente END) AS oe_cod_produtolente,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN ocrl.descricaolente END) AS oe_descricaolente,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 1 THEN prod.codigobarra END) AS oe_codigobarra,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.longe_esf END) AS od_longe_esf,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.longe_cil END) AS od_longe_cil,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.longe_eixo END) AS od_longe_eixo,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.perto_esf END) AS od_perto_esf,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.perto_cil END) AS od_perto_cil,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.perto_eixo END) AS od_perto_eixo,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.dnp END) AS od_dnp,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.perto_dnp END) AS od_perto_dnp,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.alt END) AS od_alt,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.adicao END) AS od_adicao,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.lcdiametro END) AS od_lcdiametro,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.cro END) AS od_cro,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.cod_produtolente END) AS od_cod_produtolente,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN ocrl.descricaolente END) AS od_descricaolente,
        MAX(CASE WHEN ocrl.cod_clientereceitalente = 2 THEN prod.codigobarra END) AS od_codigobarra
    FROM otiljclientereceita_lente ocrl
    LEFT JOIN produto prod
      ON prod.cod_produto = ocrl.cod_produtolente
    GROUP BY ocrl.cod_clientereceita
)

SELECT
    ocx.cod_ordemservicocaixa      AS cod_os,
    ocx.numeroordemservico         AS os,
    ocx.dataemissao                AS dataemissao,
    ocx.dataprevisao               AS dataprevisao,
    ocx.total                      AS total,
    ocx.cod_empresaorigem          AS cod_empresa_origem,
    pe.nome                        AS empresa,
    ocx.cod_cliente                AS codcliente,
    pc.nome                        AS cliente,
    pc.telefone                    AS telefone,
    pv.nome                        AS vendedor,
    ocx.observacao                 AS observacao_os,
    ocx.observacaointerna          AS observacao_interna_os,

    -- Receita geral (ótica) com fallback do cadastro do cliente
    COALESCE(otoi.dp, ocr.dp)                        AS dp,
    COALESCE(otoi.perto_dp, ocr.perto_dp)            AS perto_dp,
    COALESCE(otoi.distancialeitura, ocr.distancialeitura) AS distancia_leitura,
    COALESCE(otoi.distanciaprogressao, ocr.distanciaprogressao) AS distancia_progressao,
    COALESCE(otoi.distanciavertice, ocr.distanciavertice) AS distancia_vertice,
    COALESCE(otoi.eixo, ocr.eixo)                    AS eixo_geral,
    COALESCE(otoi.ponte, ocr.ponte)                  AS ponte,
    COALESCE(otoi.aa, ocr.aa)                        AS aa_vertical,
    COALESCE(otoi.ca, ocr.ca)                        AS ca_horizontal,
    COALESCE(otoi.diametro, ocr.diametro)            AS diametro,
    COALESCE(otoi.ta, ocr.ta)                        AS ta,
    COALESCE(otoi.md, ocr.md)                        AS md,
    COALESCE(otoi.he, ocr.he)                        AS he,
    COALESCE(otoi.st, ocr.st)                        AS st,
    otoi.observacaolente           AS observacao_lente,
    otoi.observacaopendencia       AS observacao_pendencia,

    -- Receita por olho (ordem de serviço ótica lente) - sem fallback
    -- O frontend já tem lógica de fallback implementada
    osl.od_longe_esf        AS od_longe_esf,
    osl.od_longe_cil        AS od_longe_cil,
    osl.od_longe_eixo       AS od_longe_eixo,
    osl.od_perto_esf        AS od_perto_esf,
    osl.od_perto_cil        AS od_perto_cil,
    osl.od_perto_eixo       AS od_perto_eixo,
    osl.od_dp               AS od_dp,
    osl.od_alt              AS od_alt,
    osl.od_adicao           AS od_adicao,

    osl.oe_longe_esf        AS oe_longe_esf,
    osl.oe_longe_cil        AS oe_longe_cil,
    osl.oe_longe_eixo       AS oe_longe_eixo,
    osl.oe_perto_esf        AS oe_perto_esf,
    osl.oe_perto_cil        AS oe_perto_cil,
    osl.oe_perto_eixo       AS oe_perto_eixo,
    osl.oe_dp               AS oe_dp,
    osl.oe_alt              AS oe_alt,
    osl.oe_adicao           AS oe_adicao,

    -- Observação da receita do cliente (quando existir)
    ocr.observacaoreceita          AS observacao_receita,
    ocrl.oe_longe_esf              AS ocrl_oe_longe_esf,
    ocrl.oe_longe_cil              AS ocrl_oe_longe_cil,
    ocrl.oe_longe_eixo             AS ocrl_oe_longe_eixo,
    ocrl.oe_perto_esf              AS ocrl_oe_perto_esf,
    ocrl.oe_perto_cil              AS ocrl_oe_perto_cil,
    ocrl.oe_perto_eixo             AS ocrl_oe_perto_eixo,
    ocrl.oe_dnp                    AS ocrl_oe_dnp,
    ocrl.oe_perto_dnp              AS ocrl_oe_perto_dnp,
    ocrl.oe_alt                    AS ocrl_oe_alt,
    ocrl.oe_adicao                 AS ocrl_oe_adicao,
    ocrl.oe_lcdiametro             AS ocrl_oe_lcdiametro,
    ocrl.oe_cro                    AS ocrl_oe_cro,
    ocrl.oe_cod_produtolente       AS ocrl_oe_cod_produtolente,
    ocrl.oe_descricaolente         AS ocrl_oe_descricaolente,
    ocrl.oe_codigobarra            AS ocrl_oe_codigobarra,
    ocrl.od_longe_esf              AS ocrl_od_longe_esf,
    ocrl.od_longe_cil              AS ocrl_od_longe_cil,
    ocrl.od_longe_eixo             AS ocrl_od_longe_eixo,
    ocrl.od_perto_esf              AS ocrl_od_perto_esf,
    ocrl.od_perto_cil              AS ocrl_od_perto_cil,
    ocrl.od_perto_eixo             AS ocrl_od_perto_eixo,
    ocrl.od_dnp                    AS ocrl_od_dnp,
    ocrl.od_perto_dnp              AS ocrl_od_perto_dnp,
    ocrl.od_alt                    AS ocrl_od_alt,
    ocrl.od_adicao                 AS ocrl_od_adicao,
    ocrl.od_lcdiametro             AS ocrl_od_lcdiametro,
    ocrl.od_cro                    AS ocrl_od_cro,
    ocrl.od_cod_produtolente       AS ocrl_od_cod_produtolente,
    ocrl.od_descricaolente         AS ocrl_od_descricaolente,
    ocrl.od_codigobarra            AS ocrl_od_codigobarra,

    -- Lentes (descrição dos produtos LG por olho)
    lensitems.lente_od_descricao AS lente_od_descricao,
    lensitems.lente_oe_descricao AS lente_oe_descricao,

    -- Imagens da receita/armação
    otoi.imagemreceita             AS imagem_receita,
    otoi.urlimagemreceita          AS url_imagem_receita,
    otoi.imagemarmacao             AS imagem_armacao,
    otoi.urlimagemarmacao          AS url_imagem_armacao,
    ocx.imagemdocumento            AS imagem_documento,
    ocx.urlimagemdocumento         AS url_imagem_documento,
    ocx.imagemtracer               AS imagem_tracer,
    ocx.arquivotracer              AS arquivo_tracer

FROM ordemservicocaixa ocx
JOIN pessoa pe
  ON pe.cod_pessoa = ocx.cod_empresaorigem
JOIN pessoa pc
  ON pc.cod_pessoa = ocx.cod_cliente
LEFT JOIN pessoa pv
  ON pv.cod_pessoa = ocx.cod_vendedor
LEFT JOIN otiordemservicootica otoi
  ON otoi.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN ordemservicooticalente osl
  ON osl.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN otiljclientereceita ocr
  ON ocr.cod_clientereceita = ocx.cod_clientereceita
LEFT JOIN receita_lente_cliente ocrl
  ON ocrl.cod_clientereceita = ocr.cod_clientereceita
LEFT JOIN itens_lente lensitems
  ON lensitems.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa

WHERE
    ( ? IS NULL OR ocx.numeroordemservico = CAST(? AS INTEGER) )
    AND ocx.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
    AND ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )

ORDER BY pe.nome, ocx.dataemissao, ocx.numeroordemservico;
