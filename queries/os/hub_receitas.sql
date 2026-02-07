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
otoi_unificada AS (
    -- Deduplicação: alguns ambientes salvam mais de um registro por OS/transação.
    -- Usamos agregação com MAX para colapsar em uma linha sem multiplicar a OS.
    -- Guard rail: os registros esperados são 1:1; quando há mais de um, os campos
    -- são idênticos ou mutuamente exclusivos, conforme validado nas queries de diagnóstico.
    SELECT
        cod_ordemservicocaixa,
        cod_transacao,
        MAX(dp) AS dp,
        MAX(perto_dp) AS perto_dp,
        MAX(distancialeitura) AS distancialeitura,
        MAX(distanciaprogressao) AS distanciaprogressao,
        MAX(distanciavertice) AS distanciavertice,
        MAX(eixo) AS eixo,
        MAX(ponte) AS ponte,
        MAX(aa) AS aa,
        MAX(ca) AS ca,
        MAX(diametro) AS diametro,
        MAX(ta) AS ta,
        MAX(md) AS md,
        MAX(he) AS he,
        MAX(st) AS st,
        MAX(observacaolente) AS observacaolente,
        MAX(observacaopendencia) AS observacaopendencia,
        MAX(imagemreceita) AS imagemreceita,
        MAX(urlimagemreceita) AS urlimagemreceita,
        MAX(imagemarmacao) AS imagemarmacao,
        MAX(urlimagemarmacao) AS urlimagemarmacao
    FROM otiordemservicootica
    GROUP BY cod_ordemservicocaixa, cod_transacao
),
osl_dedup AS (
    SELECT
        cod_ordemservicocaixa,
        cod_transacao,
        MAX(od_longe_esf) AS od_longe_esf,
        MAX(od_longe_cil) AS od_longe_cil,
        MAX(od_longe_eixo) AS od_longe_eixo,
        MAX(od_perto_esf) AS od_perto_esf,
        MAX(od_perto_cil) AS od_perto_cil,
        MAX(od_perto_eixo) AS od_perto_eixo,
        MAX(od_dp) AS od_dp,
        MAX(od_alt) AS od_alt,
        MAX(od_adicao) AS od_adicao,
        MAX(oe_longe_esf) AS oe_longe_esf,
        MAX(oe_longe_cil) AS oe_longe_cil,
        MAX(oe_longe_eixo) AS oe_longe_eixo,
        MAX(oe_perto_esf) AS oe_perto_esf,
        MAX(oe_perto_cil) AS oe_perto_cil,
        MAX(oe_perto_eixo) AS oe_perto_eixo,
        MAX(oe_dp) AS oe_dp,
        MAX(oe_alt) AS oe_alt,
        MAX(oe_adicao) AS oe_adicao
    FROM ordemservicooticalente
    GROUP BY cod_ordemservicocaixa, cod_transacao
),
itens_lente_os AS (
    -- Caminho principal: separa lentes OD/OE via COD_ORDEMSERVICOCAIXA (quando preenchido)
    SELECT
        ti.cod_ordemservicocaixa,
        -- Primeira lente (OD - Olho Direito)
        (SELECT FIRST 1 i2.descricao 
         FROM transacao_item ti2 
          JOIN item i2 ON i2.cod_item = ti2.cod_item
          WHERE ti2.cod_ordemservicocaixa = ti.cod_ordemservicocaixa
            AND i2.descricao LIKE 'LG%'
          ORDER BY ti2.cod_transacaoitem) AS lente_od_descricao,
        -- Segunda lente (OE - Olho Esquerdo)  
        (SELECT FIRST 1 SKIP 1 i2.descricao 
         FROM transacao_item ti2 
          JOIN item i2 ON i2.cod_item = ti2.cod_item
         WHERE ti2.cod_ordemservicocaixa = ti.cod_ordemservicocaixa
            AND i2.descricao LIKE 'LG%'
          ORDER BY ti2.cod_transacaoitem) AS lente_oe_descricao
    FROM transacao_item ti
    WHERE ti.cod_ordemservicocaixa IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM item i 
          WHERE i.cod_item = ti.cod_item 
            AND i.descricao LIKE 'LG%'
      )
    GROUP BY ti.cod_ordemservicocaixa
),
itens_lente_num AS (
    -- Fallback por numeroordemservico quando COD_ORDEMSERVICOCAIXA não está populado
    SELECT
        ti.numeroordemservico,
        (SELECT FIRST 1 i2.descricao 
         FROM transacao_item ti2 
          JOIN item i2 ON i2.cod_item = ti2.cod_item
         WHERE ti2.numeroordemservico = ti.numeroordemservico
            AND i2.descricao LIKE 'LG%'
          ORDER BY ti2.cod_transacaoitem) AS lente_od_descricao,
        (SELECT FIRST 1 SKIP 1 i2.descricao 
         FROM transacao_item ti2 
          JOIN item i2 ON i2.cod_item = ti2.cod_item
         WHERE ti2.numeroordemservico = ti.numeroordemservico
            AND i2.descricao LIKE 'LG%'
          ORDER BY ti2.cod_transacaoitem) AS lente_oe_descricao
    FROM transacao_item ti
    WHERE ti.cod_ordemservicocaixa IS NULL
      AND ti.numeroordemservico IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM item i 
          WHERE i.cod_item = ti.cod_item 
            AND i.descricao LIKE 'LG%'
      )
    GROUP BY ti.numeroordemservico
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
    COALESCE(otoi_os.dp, otoi_tx.dp, ocr.dp)                        AS dp,
    COALESCE(otoi_os.perto_dp, otoi_tx.perto_dp, ocr.perto_dp)      AS perto_dp,
    COALESCE(otoi_os.distancialeitura, otoi_tx.distancialeitura, ocr.distancialeitura) AS distancia_leitura,
    COALESCE(otoi_os.distanciaprogressao, otoi_tx.distanciaprogressao, ocr.distanciaprogressao) AS distancia_progressao,
    COALESCE(otoi_os.distanciavertice, otoi_tx.distanciavertice, ocr.distanciavertice) AS distancia_vertice,
    COALESCE(otoi_os.eixo, otoi_tx.eixo, ocr.eixo)                  AS eixo_geral,
    COALESCE(otoi_os.ponte, otoi_tx.ponte, ocr.ponte)               AS ponte,
    COALESCE(otoi_os.aa, otoi_tx.aa, ocr.aa)                        AS aa_vertical,
    COALESCE(otoi_os.ca, otoi_tx.ca, ocr.ca)                        AS ca_horizontal,
    COALESCE(otoi_os.diametro, otoi_tx.diametro, ocr.diametro)      AS diametro,
    COALESCE(otoi_os.ta, otoi_tx.ta, ocr.ta)                        AS ta,
    COALESCE(otoi_os.md, otoi_tx.md, ocr.md)                        AS md,
    COALESCE(otoi_os.he, otoi_tx.he, ocr.he)                        AS he,
    COALESCE(otoi_os.st, otoi_tx.st, ocr.st)                        AS st,
    COALESCE(otoi_os.observacaolente, otoi_tx.observacaolente)      AS observacao_lente,
    COALESCE(otoi_os.observacaopendencia, otoi_tx.observacaopendencia) AS observacao_pendencia,

    -- Receita por olho (ordem de serviço ótica lente) - SEMPRE usar dados da OS, não do cliente
    -- OD (Olho Direito) - dados específicos da transação da OS
    COALESCE(osl_os.od_longe_esf, osl_tx.od_longe_esf)        AS od_longe_esf,
    COALESCE(osl_os.od_longe_cil, osl_tx.od_longe_cil)        AS od_longe_cil,
    COALESCE(osl_os.od_longe_eixo, osl_tx.od_longe_eixo)      AS od_longe_eixo,
    COALESCE(osl_os.od_perto_esf, osl_tx.od_perto_esf)        AS od_perto_esf,
    COALESCE(osl_os.od_perto_cil, osl_tx.od_perto_cil)        AS od_perto_cil,
    COALESCE(osl_os.od_perto_eixo, osl_tx.od_perto_eixo)      AS od_perto_eixo,
    COALESCE(osl_os.od_dp, osl_tx.od_dp)                      AS od_dp,
    COALESCE(osl_os.od_alt, osl_tx.od_alt)                    AS od_alt,
    COALESCE(osl_os.od_adicao, osl_tx.od_adicao)              AS od_adicao,

    -- OE (Olho Esquerdo) - dados específicos da transação da OS
    COALESCE(osl_os.oe_longe_esf, osl_tx.oe_longe_esf)        AS oe_longe_esf,
    COALESCE(osl_os.oe_longe_cil, osl_tx.oe_longe_cil)        AS oe_longe_cil,
    COALESCE(osl_os.oe_longe_eixo, osl_tx.oe_longe_eixo)      AS oe_longe_eixo,
    COALESCE(osl_os.oe_perto_esf, osl_tx.oe_perto_esf)        AS oe_perto_esf,
    COALESCE(osl_os.oe_perto_cil, osl_tx.oe_perto_cil)        AS oe_perto_cil,
    COALESCE(osl_os.oe_perto_eixo, osl_tx.oe_perto_eixo)      AS oe_perto_eixo,
    COALESCE(osl_os.oe_dp, osl_tx.oe_dp)                      AS oe_dp,
    COALESCE(osl_os.oe_alt, osl_tx.oe_alt)                    AS oe_alt,
    COALESCE(osl_os.oe_adicao, osl_tx.oe_adicao)              AS oe_adicao,

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
    COALESCE(lensitems_os.lente_od_descricao, lensitems_num.lente_od_descricao) AS lente_od_descricao,
    COALESCE(lensitems_os.lente_oe_descricao, lensitems_num.lente_oe_descricao) AS lente_oe_descricao,

    -- Imagens da receita/armação
    COALESCE(otoi_os.imagemreceita, otoi_tx.imagemreceita)             AS imagem_receita,
    COALESCE(otoi_os.urlimagemreceita, otoi_tx.urlimagemreceita)       AS url_imagem_receita,
    COALESCE(otoi_os.imagemarmacao, otoi_tx.imagemarmacao)             AS imagem_armacao,
    COALESCE(otoi_os.urlimagemarmacao, otoi_tx.urlimagemarmacao)       AS url_imagem_armacao,
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
-- Une receitas óticas tanto por COD_ORDEMSERVICOCAIXA quanto por COD_TRANSACAO
-- (ambientes diferentes podem preencher apenas um dos campos). CTE deduplicada evita multiplicação.
LEFT JOIN otoi_unificada otoi_os
  ON otoi_os.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN otoi_unificada otoi_tx
  ON otoi_tx.cod_transacao = ocx.cod_transacao
LEFT JOIN osl_dedup osl_os
  ON osl_os.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN osl_dedup osl_tx
  ON osl_tx.cod_transacao = ocx.cod_transacao
-- COALESCE prioriza sempre o match por COD_ORDEMSERVICOCAIXA (otoi_os/osl_os)
-- e só cai para COD_TRANSACAO (otoi_tx/osl_tx) se o primeiro estiver ausente.
LEFT JOIN otoi_lente_agg lensagg
  ON lensagg.cod_transacao = ocx.cod_transacao
LEFT JOIN otiljclientereceita ocr
  ON ocr.cod_clientereceita = ocx.cod_clientereceita
LEFT JOIN itens_lente_os lensitems_os
  ON lensitems_os.cod_ordemservicocaixa = ocx.cod_ordemservicocaixa
LEFT JOIN itens_lente_num lensitems_num
  ON lensitems_num.numeroordemservico = ocx.numeroordemservico

WHERE
    ( ? IS NULL OR ocx.numeroordemservico = CAST(? AS INTEGER) )
    AND ocx.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
    AND ( ? IS NULL OR ocx.cod_empresaorigem = CAST(? AS INTEGER) )

ORDER BY pe.nome, ocx.dataemissao, ocx.numeroordemservico;
