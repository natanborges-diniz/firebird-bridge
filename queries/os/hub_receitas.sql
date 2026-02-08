-- queries/os/hub_receitas.sql
-- Hub de OS + receita + imagens (filtros por data e empresa)

WITH itens_lente AS (
    SELECT
        ocx.cod_ordemservicocaixa,
        LIST(DISTINCT i.descricao, ', ') AS lente_descricao
    FROM ordemservicocaixa ocx
    JOIN transacao_item ti
      ON ti.cod_transacao = ocx.cod_transacao
     AND (ti.cod_empresa = ocx.cod_empresaorigem OR ocx.cod_empresaorigem IS NULL)
    JOIN item i
      ON i.cod_item = ti.cod_item
    JOIN produto p
      ON p.cod_produto = i.cod_item
    JOIN otiprodutolente l
      ON l.cod_produtolente = p.cod_produto
    GROUP BY ocx.cod_ordemservicocaixa
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

    -- Receita por olho (ordem de serviço ótica lente) com fallback do cadastro do cliente
    COALESCE(osl.od_longe_esf, ocrl.longe_esf)        AS od_longe_esf,
    COALESCE(osl.od_longe_cil, ocrl.longe_cil)        AS od_longe_cil,
    COALESCE(osl.od_longe_eixo, ocrl.longe_eixo)      AS od_longe_eixo,
    COALESCE(osl.od_perto_esf, ocrl.perto_esf)        AS od_perto_esf,
    COALESCE(osl.od_perto_cil, ocrl.perto_cil)        AS od_perto_cil,
    COALESCE(osl.od_perto_eixo, ocrl.perto_eixo)      AS od_perto_eixo,
    COALESCE(osl.od_dp, ocrl.dnp)                     AS od_dp,
    COALESCE(osl.od_alt, ocrl.alt)                    AS od_alt,
    COALESCE(osl.od_adicao, ocrl.adicao)              AS od_adicao,

    COALESCE(osl.oe_longe_esf, ocrl.longe_esf)        AS oe_longe_esf,
    COALESCE(osl.oe_longe_cil, ocrl.longe_cil)        AS oe_longe_cil,
    COALESCE(osl.oe_longe_eixo, ocrl.longe_eixo)      AS oe_longe_eixo,
    COALESCE(osl.oe_perto_esf, ocrl.perto_esf)        AS oe_perto_esf,
    COALESCE(osl.oe_perto_cil, ocrl.perto_cil)        AS oe_perto_cil,
    COALESCE(osl.oe_perto_eixo, ocrl.perto_eixo)      AS oe_perto_eixo,
    COALESCE(osl.oe_dp, ocrl.dnp)                     AS oe_dp,
    COALESCE(osl.oe_alt, ocrl.alt)                    AS oe_alt,
    COALESCE(osl.oe_adicao, ocrl.adicao)              AS oe_adicao,

    -- Observação da receita do cliente (quando existir)
    ocr.observacaoreceita          AS observacao_receita,

    -- Lentes (descrição dos produtos LG por olho)
    lensitems.lente_descricao AS lente_od_descricao,
    lensitems.lente_descricao AS lente_oe_descricao,

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
