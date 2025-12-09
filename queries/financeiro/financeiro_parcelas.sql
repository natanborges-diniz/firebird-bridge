select distinct
  fl.cod_empresa as cod_empresa,
  pe_emp.nome    as empresa_nome
from
  finlancamento fl
    join finlancamentoparcela fp
      on fp.cod_lancamento = fl.cod_lancamento
    join pessoa pe_emp
      on pe_emp.cod_pessoa = fl.cod_empresa
order by fl.cod_empresa
rows 20;
