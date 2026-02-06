-- queries/os/hub_receitas.sql
-- Hub de OS + receita + imagens (filtros por data e empresa)

WITH otoi_lente_agg AS (
    SELECT
        cod_transacao,
        LIST(prisma, ', ') AS prisma,
        LIST(prismaangulo, ', ') AS prismaangulo,
        LIST(prismaeixo, ', ') AS prismaeixo,
        LIST(prisma1, ', ') AS prisma1,
        LIST(prisma1angulo, ', ') AS prisma1angulo,
        LIST(prisma1eixo, ', ') AS prisma1eixo
    FROM (
        SELECT DISTINCT
            cod_transacao,
            prisma,
            prismaangulo,
            prismaeixo,
            prisma1,
            prisma1angulo,
            prisma1eixo
        FROM otiordemservicootica_lente
    ) prismas_distintos
    GROUP BY cod_transacao
),
otio_lente_campos AS (
    SELECT
        cod_transacao,
        MAX(descricaolente) AS descricao_lente,
        MAX(adicao) AS adicao,
        MAX(alt) AS alt,
        MAX(dnp) AS dnp,
        MAX(longe_esf) AS longe_esf,
        MAX(longe_cil) AS longe_cil,
        MAX(longe_eixo) AS longe_eixo,
        MAX(perto_esf) AS perto_esf,
        MAX(perto_cil) AS perto_cil,
        MAX(perto_eixo) AS perto_eixo,
        MAX(perto_dnp) AS perto_dnp,
        MAX(cro) AS cro,
        MAX(prisma) AS prisma,
        MAX(prismaangulo) AS prismaangulo,
        MAX(prismaeixo) AS prismaeixo,
        MAX(prisma1) AS prisma1,
        MAX(prisma1angulo) AS prisma1angulo,
        MAX(prisma1eixo) AS prisma1eixo
    FROM otiordemservicootica_lente
    GROUP BY cod_transacao
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
    ocx.observacao                 AS observacao_os,
    ocx.observacaointerna          AS observacao_interna_os,

    -- Receita geral (ótica)
    otoi.dp                        AS dp,
    otoi.perto_dp                  AS perto_dp,
    otoi.distancialeitura          AS distancia_leitura,
    otoi.distanciaprogressao       AS distancia_progressao,
    otoi.distanciavertice          AS distancia_vertice,
    otoi.eixo                      AS eixo_geral,
    otoi.ponte                     AS ponte,
    otoi.aa                        AS aa_vertical,
    otoi.ca                        AS ca_horizontal,
    otoi.diametro                  AS diametro,
    otoi.ta                        AS ta,
    otoi.md                        AS md,
    otoi.he                        AS he,
    otoi.st                        AS st,
    otoi.observacaolente           AS observacao_lente,
    otoi.observacaopendencia       AS observacao_pendencia,

    -- Receita por olho (ordem de serviço ótica lente)
    osl.od_longe_esf               AS od_longe_esf,
    osl.od_longe_cil               AS od_longe_cil,
    osl.od_longe_eixo              AS od_longe_eixo,
    osl.od_perto_esf               AS od_perto_esf,
    osl.od_perto_cil               AS od_perto_cil,
    osl.od_perto_eixo              AS od_perto_eixo,
    osl.od_dp                      AS od_dp,
    osl.od_alt                     AS od_alt,
    osl.od_adicao                  AS od_adicao,

    osl.oe_longe_esf               AS oe_longe_esf,
    osl.oe_longe_cil               AS oe_longe_cil,
    osl.oe_longe_eixo              AS oe_longe_eixo,
    osl.oe_perto_esf               AS oe_perto_esf,
    osl.oe_perto_cil               AS oe_perto_cil,
    osl.oe_perto_eixo              AS oe_perto_eixo,
    osl.oe_dp                      AS oe_dp,
    osl.oe_alt                     AS oe_alt,
    osl.oe_adicao                  AS oe_adicao,

    -- Prismas (agregados por transação)
    lensagg.prisma                 AS prisma,
    lensagg.prismaangulo           AS prismaangulo,
    lensagg.prismaeixo             AS prismaeixo,
    lensagg.prisma1                AS prisma1,
    lensagg.prisma1angulo          AS prisma1angulo,
    lensagg.prisma1eixo            AS prisma1eixo,

    -- Receita alternativa (ótica lente - campos completos)
    otio.descricao_lente           AS lente_descricao,
    otio.adicao                    AS lente_adicao,
    otio.alt                       AS lente_alt,
    otio.dnp                       AS lente_dnp,
    otio.longe_esf                 AS lente_longe_esf,
    otio.longe_cil                 AS lente_longe_cil,
    otio.longe_eixo                AS lente_longe_eixo,
    otio.perto_esf                 AS lente_perto_esf,
    otio.perto_cil                 AS lente_perto_cil,
    otio.perto_eixo                AS lente_perto_eixo,
    otio.perto_dnp                 AS lente_perto_dnp,
    otio.cro                       AS lente_cro,
    otio.prisma                    AS lente_prisma,
    otio.prismaangulo              AS lente_prismaangulo,
    otio.prismaeixo                AS lente_prismaeixo,
    otio.prisma1                   AS lente_prisma1,
    otio.prisma1angulo             AS lente_prisma1angulo,
    otio.prisma1eixo               AS lente_prisma1eixo,

    -- Receita do cliente (fallback quando não há transação)
    ocr.eixo                       AS cliente_eixo,
    ocr.dp                         AS cliente_dp,
    ocr.perto_dp                   AS cliente_perto_dp,
    ocr.distancialeitura           AS cliente_distancia_leitura,
    ocr.distanciaprogressao        AS cliente_distancia_progressao,
    ocr.distanciavertice           AS cliente_distancia_vertice,
    ocr.ponte                      AS cliente_ponte,
    ocr.aa                         AS cliente_aa_vertical,
    ocr.ca                         AS cliente_ca_horizontal,
    ocr.diametro                   AS cliente_diametro,
    ocr.ta                         AS cliente_ta,
    ocr.md                         AS cliente_md,
    ocr.he                         AS cliente_he,
    ocr.st                         AS cliente_st,
    ocr.observacaoreceita          AS cliente_observacao_receita,
    ocrl.longe_esf                 AS cliente_longe_esf,
    ocrl.longe_cil                 AS cliente_longe_cil,
    ocrl.longe_eixo                AS cliente_longe_eixo,
    ocrl.perto_esf                 AS cliente_perto_esf,
    ocrl.perto_cil                 AS cliente_perto_cil,
    ocrl.perto_eixo                AS cliente_perto_eixo,
    ocrl.dnp                       AS cliente_dnp,
    ocrl.alt                       AS cliente_alt,
    ocrl.adicao                    AS cliente_adicao,
    ocrl.prisma                    AS cliente_prisma,
    ocrl.prismaangulo              AS cliente_prismaangulo,
    ocrl.prismaeixo                AS cliente_prismaeixo,
    ocrl.prisma1                   AS cliente_prisma1,
    ocrl.prisma1angulo             AS cliente_prisma1angulo,
    ocrl.prisma1eixo               AS cliente_prisma1eixo,

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
LEFT JOIN otiordemservicootica otoi
  ON otoi.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN ordemservicooticalente osl
  ON osl.cod_transacao = ocx.cod_transacao
LEFT JOIN otoi_lente_agg lensagg
  ON lensagg.cod_transacao = ocx.cod_transacao
LEFT JOIN otio_lente_campos otio
  ON otio.cod_transacao = ocx.cod_transacao
LEFT JOIN otiljclientereceita ocr
  ON ocr.cod_clientereceita = ocx.cod_clientereceita
LEFT JOIN otiljclientereceita_lente ocrl
  ON ocrl.cod_clientereceita = ocr.cod_clientereceita

WHERE
    ( ? IS NULL OR ocx.numeroordemservico = CAST(? AS INTEGER) )
    AND ocx.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
    AND ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )

ORDER BY pe.nome, ocx.dataemissao, ocx.numeroordemservico;
