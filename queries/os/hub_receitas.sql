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
itens_lente AS (
    -- Separa lentes OD e OE baseado na sequência ou ordem de inserção
    SELECT
        ti.cod_ordemservicocaixa,
        -- Primeira lente (OD - Olho Direito)
        (SELECT FIRST 1 i2.descricao 
         FROM transacao_item ti2 
         JOIN item i2 ON i2.cod_item = ti2.cod_item
         WHERE ti2.cod_ordemservicocaixa = ti.cod_ordemservicocaixa
           AND i2.descricao LIKE 'LG%'
         ORDER BY COALESCE(ti2.sequencia, 999), ti2.cod_transacao_item) AS lente_od_descricao,
        -- Segunda lente (OE - Olho Esquerdo)  
        (SELECT FIRST 1 SKIP 1 i2.descricao 
         FROM transacao_item ti2 
         JOIN item i2 ON i2.cod_item = ti2.cod_item
         WHERE ti2.cod_ordemservicocaixa = ti.cod_ordemservicocaixa
           AND i2.descricao LIKE 'LG%'
         ORDER BY COALESCE(ti2.sequencia, 999), ti2.cod_transacao_item) AS lente_oe_descricao
    FROM transacao_item ti
    WHERE ti.cod_ordemservicocaixa IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM item i 
          WHERE i.cod_item = ti.cod_item 
            AND i.descricao LIKE 'LG%'
      )
    GROUP BY ti.cod_ordemservicocaixa
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

    -- Receita por olho (ordem de serviço ótica lente) - SEMPRE usar dados da OS, não do cliente
    -- OD (Olho Direito) - dados específicos da transação da OS
    osl.od_longe_esf        AS od_longe_esf,
    osl.od_longe_cil        AS od_longe_cil,
    osl.od_longe_eixo       AS od_longe_eixo,
    osl.od_perto_esf        AS od_perto_esf,
    osl.od_perto_cil        AS od_perto_cil,
    osl.od_perto_eixo       AS od_perto_eixo,
    osl.od_dp               AS od_dp,
    osl.od_alt              AS od_alt,
    osl.od_adicao           AS od_adicao,

    -- OE (Olho Esquerdo) - dados específicos da transação da OS
    osl.oe_longe_esf        AS oe_longe_esf,
    osl.oe_longe_cil        AS oe_longe_cil,
    osl.oe_longe_eixo       AS oe_longe_eixo,
    osl.oe_perto_esf        AS oe_perto_esf,
    osl.oe_perto_cil        AS oe_perto_cil,
    osl.oe_perto_eixo       AS oe_perto_eixo,
    osl.oe_dp               AS oe_dp,
    osl.oe_alt              AS oe_alt,
    osl.oe_adicao           AS oe_adicao,

    -- Prismas (agregados por transação)
    lensagg.prisma                 AS prisma,
    lensagg.prismaangulo           AS prismaangulo,
    lensagg.prismaeixo             AS prismaeixo,
    lensagg.prisma1                AS prisma1,
    lensagg.prisma1angulo          AS prisma1angulo,
    lensagg.prisma1eixo            AS prisma1eixo,

    -- Observação da receita do cliente (quando existir)
    ocr.observacaoreceita          AS observacao_receita,

    -- Lentes (descrição dos produtos LG por olho) - SEPARADAS por olho
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
  ON osl.cod_transacao = ocx.cod_transacao
LEFT JOIN otoi_lente_agg lensagg
  ON lensagg.cod_transacao = ocx.cod_transacao
LEFT JOIN otiljclientereceita ocr
  ON ocr.cod_clientereceita = ocx.cod_clientereceita
LEFT JOIN otiljclientereceita_lente ocrl
  ON ocrl.cod_clientereceita = ocr.cod_clientereceita
LEFT JOIN itens_lente lensitems
  ON lensitems.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa

WHERE
    ( ? IS NULL OR ocx.numeroordemservico = CAST(? AS INTEGER) )
    AND ocx.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
    AND ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )

ORDER BY pe.nome, ocx.dataemissao, ocx.numeroordemservico;
