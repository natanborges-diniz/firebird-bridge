-- Frescor da copia do banco (independente de movimento de negocio).
--
-- MON$CREATION_DATE = momento em que ESTA copia do banco foi criada.
-- Num restore diario via gbak (backup -> restore), esse campo avanca
-- a cada execucao do job, mesmo em feriado sem nenhuma transacao.
-- Por isso ele mede "o job da copia rodou", nao "houve venda".
--
-- Requer Firebird 3+. Em versoes antigas a coluna nao existe e a query
-- falha; o service (healthFreshnessService) trata o erro e devolve
-- status 'indisponivel' (fallback gracioso).
SELECT MON$CREATION_DATE AS creation_date
  FROM MON$DATABASE
