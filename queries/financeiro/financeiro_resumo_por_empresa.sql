select
  fl.cod_empresa                              as cod_empresa,
  pe_emp.nome                                 as empresa_nome,
  
  /* CAMPOS LÓGICOS DE EMPRESA (SUPER + SUPER SHOPPING) */
  case
    when fl.cod_empresa in (13, 18) then 13
    else fl.cod_empresa
  end                                         as empresa_cod_logico,

  case
    when fl.cod_empresa in (13, 18) then 'DINIZ SUPER'
    else pe_emp.nome
  end                                         as empresa_nome_logico,

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
  /* Ignora empresas lixo */
  fl.cod_empresa not in (3, 5, 7, 8, 11, 12)
  and (
    /* Empresas normais: filtra direto pelo código informado */
    fl.cod_empresa = cast(? as integer)
    or (
      /* Se a empresa pedida for 13 ou 18, traz tanto 13 quanto 18 */
      cast(? as integer) in (13, 18)
      and fl.cod_empresa in (13, 18)
    )
  )
  -- limita para não pegar "a vida inteira"
  fp.datavencimento >= '2020-01-01'

group by
  fl.cod_empresa,
  pe_emp.nome

order by
  fl.cod_empresa;
