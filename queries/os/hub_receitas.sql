-- queries/os/hub_receitas.sql
-- Hub de OS + receita + imagens (filtros por data e empresa)

WITH itens_lente AS (
    SELECT
        ti.cod_ordemservicocaixa,
        MAX(CASE 
            WHEN rn = 1 THEN i.descricao 
            ELSE NULL 
        END) AS lente_od_descricao,
        MAX(CASE 
            WHEN rn = 2 THEN i.descricao 
            ELSE NULL 
        END) AS lente_oe_descricao
    FROM (
        SELECT
            ti.cod_ordemservicocaixa,
            i.descricao,
            ROW_NUMBER() OVER (
                PARTITION BY ti.cod_ordemservicocaixa 
                ORDER BY COALESCE(ti.sequencia, ti.seq_item, 999), ti.cod_transacao_item
            ) AS rn
        FROM transacao_item ti
        JOIN item i ON i.cod_item = ti.cod_item
        JOIN produto p ON p.cod_produto = i.cod_item
        JOIN otiprodutolente l ON l.cod_produtolente = p.cod_produto
        WHERE ti.cod_ordemservicocaixa IS NOT NULL
    ) ranked
    GROUP BY ranked.cod_ordemservicocaixa
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
LEFT JOIN itens_lente lensitems
  ON lensitems.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa

WHERE
    ( ? IS NULL OR ocx.numeroordemservico = CAST(? AS INTEGER) )
    AND ocx.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
    AND ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )

ORDER BY pe.nome, ocx.dataemissao, ocx.numeroordemservico;
