-- queries/debug/produto_tipo_por_empresa.sql (rota /debug/produto-tipo-map/dist)
-- [INVESTIGACAO] Tenta ler direto a tabela tbtipoprodutodescricao. Se nao
-- existir, safeRun captura e reporta o erro (SQLCODE -204 no Firebird).
-- Nenhum parametro.
SELECT FIRST 20
  *
FROM
  tbtipoprodutodescricao
;
