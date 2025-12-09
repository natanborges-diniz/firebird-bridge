select
  /* EMPRESA FÍSICA */
  fl.cod_empresa                              as cod_empresa,
  pe_emp.nome                                 as empresa_nome,

  /* EMPRESA LÓGICA (SUPER + SUPER SHOPPING) */
  case
    when fl.cod_empresa in (13, 18) then 13
    else fl.cod_empresa
  end                                         as empresa_cod_logico,

  case
    when fl.cod_empresa in (13, 18) then 'DINIZ SUPER'
    else pe_emp.nome
  end                                         as empresa_nome_logico,

  /* PERÍODO (por competência = data de emissão da parcela) */
  extract(year  from fp.dataemissao)          as ano_competencia,
  extract(month from fp.dataemissao)          as mes_competencia,

  /* CONTA CONTÁBIL */
  fcc.cod_contaclassificacao                  as contacla_codigo,
  fcc.numeroconta                             as contacla_numero,
  fcc.descricao                               as contacla_descricao,

  /* VALOR AGREGADO (receita positiva, despesa negativa) */
  sum(
    case
      when fl.pagar = 'T' then -fp.valor      -- títulos a PAGAR → despesa
      else fp.valor                           -- títulos a RECEBER → receita
    end
  )                                           as valor_total

from
  finlancamento fl
    join finlancamentoparcela fp
      on fp.cod_lancamento = fl.cod_lancamento

    left join fincontaclassificacao fcc
      on fcc.cod_contaclassificacao = fl.cod_contaclassificacao

    /* Empresa do lançamento */
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
  /* Período de competência = data de emissão da parcela */
  and fp.dataemissao between cast(? as date) and cast(? as date)

group by
  fl.cod_empresa,
  pe_emp.nome,
  empresa_cod_logico,
  empresa_nome_logico,
  extract(year  from fp.dataemissao),
  extract(month from fp.dataemissao),
  fcc.cod_contaclassificacao,
  fcc.numeroconta,
  fcc.descricao

order by
  empresa_cod_logico,
  ano_competencia,
  mes_competencia,
  contacla_numero;
