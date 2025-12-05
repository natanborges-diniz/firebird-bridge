select
  fl.cod_empresa                              as cod_empresa,
  pe_emp.nome                                 as empresa_nome,

  min(fp.datavencimento)                      as min_datavencimento,
  max(fp.datavencimento)                      as max_datavencimento,
  count(*)                                    as qtd_parcelas

from
  finlancamento fl
    join finlancamentoparcela fp
      on fp.cod_lancamento = fl.cod_lancamento

    join pessoa pe_emp
      on pe_emp.cod_pessoa = fl.cod_empresa

where
  -- limita para não pegar "a vida inteira"
  fp.datavencimento >= '2020-01-01'

group by
  fl.cod_empresa,
  pe_emp.nome

order by
  fl.cod_empresa;
