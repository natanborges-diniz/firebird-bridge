-- queries/empresas/listarEmpresas.sql
-- Lista de empresas para o Lovable
-- Regras:
--  - ignora empresas lixo: 3,5,7,8,11,12
--  - unifica SUPER (13 e 18) em uma empresa lógica só: "DINIZ SUPER"

select distinct
  -- código lógico (13 e 18 viram 13)
  case 
    when e.cod_empresa in (13, 18) then 13
    else e.cod_empresa
  end as cod_empresa,

  -- nome lógico (SUPER unificada)
  case 
    when e.cod_empresa in (13, 18) then 'DINIZ SUPER'
    else p.nome
  end as empresa_nome
from
  empresa e
  join pessoa p
    on p.cod_pessoa = e.cod_empresa
where
  -- remove empresas lixo
  e.cod_empresa not in (3, 5, 7, 8, 11, 12)
order by
  empresa_nome;
