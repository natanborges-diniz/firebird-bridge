-- queries/empresas/listarEmpresas.sql
-- Lista de empresas conforme legado (sem unificar 13/18)
-- Regras:
--  - ignora empresas lixo: 3,5,7,8,11,12

select distinct
  e.cod_empresa,
  p.nome,
  p.cnpj,
  p.razaosocial
from
  empresa e
  join pessoa p
    on p.cod_pessoa = e.cod_empresa
where
  -- remove empresas lixo
  e.cod_empresa not in (3, 5, 7, 8, 11, 12)
order by
  p.nome;
