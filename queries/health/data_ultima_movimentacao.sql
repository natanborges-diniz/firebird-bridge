-- Data da movimentacao de negocio mais recente presente NA COPIA.
--
-- Usada em conjunto com MON$CREATION_DATE (db_freshness.sql):
--   * MON$CREATION_DATE diz QUANDO a copia foi construida (job de restore).
--   * Este MAX diz qual o dado mais novo que existe DENTRO da copia.
--
-- Se a copia foi reconstruida hoje mas o dado mais novo aqui e de varios
-- dias atras, a FONTE do backup esta parada -- mesmo com o job de restore
-- rodando normalmente. Esse foi exatamente o caso observado (copia de hoje,
-- dados parados em 20/07).
--
-- transacao.dataemissao = data da venda/transacao. Toda loja aberta gera
-- transacao, entao e um bom marcador de "ate quando os dados vao".
SELECT MAX(dataemissao) AS ultima
  FROM transacao
