select
  /* EMPRESA / CONTRAPARTE */
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

  fl.cod_lancamento                           as cod_lancamento,
  fl.pagar                                    as lancamento_pagar,      -- 'T' = PAGAR, 'F' = RECEBER
  fl.previsao                                 as lancamento_previsao,   -- 'T' / 'F'
  fl.numerodocumento                          as lancamento_documento,

  p_cli.cod_pessoa                            as pessoa_cod_pessoa,
  p_cli.nome                                  as pessoa_nome,

  /* PARCELA */
  fp.cod_lancamentoparcela                    as parcela_id,
  fp.dataemissao                              as parcela_data_emissao,
  fp.datavencimento                           as parcela_data_vencimento,
  fp.datapagamento                            as parcela_data_pagamento,
  fp.datarecebimento                          as parcela_data_recebimento,
  fp.valor                                    as parcela_valor,
  fp.valororiginal                            as parcela_valor_original,
  fp.valorpago                                as parcela_valor_pago,

  /* SITUAÇÃO CALCULADA SIMPLES */
  case
    when fp.datapagamento is not null then 'PAGA'
    when fp.datapagamento is null
         and fp.datavencimento < current_date then 'EM ATRASO'
    else 'EM ABERTO'
  end                                         as parcela_situacao,

  /* CLASSIFICAÇÃO CONTÁBIL */
  fcc.cod_contaclassificacao                  as contacla_codigo,
  fcc.numeroconta                             as contacla_numero,
  fcc.descricao                               as contacla_descricao,

  /* FORMA DE PAGAMENTO (TIPO) */
  ffp.cod_formapagamento                      as formapagto_codigo,
  ffp.cod_formapagamentotipo                  as formapagto_tipo_codigo,

  case ffp.cod_formapagamentotipo
    when 1 then 'DINHEIRO'
    when 2 then 'CHEQUE'
    when 3 then 'CARTÃO'
    when 4 then 'BANCO'
    when 5 then 'CARNÊ'
    when 6 then 'CRÉDITO'
    else '(NÃO DEFINIDA)'
  end                                         as formapagto_tipo_nome

from
  finlancamento fl
    join finlancamentoparcela fp
      on fp.cod_lancamento = fl.cod_lancamento

    left join fincontaclassificacao fcc
      on fcc.cod_contaclassificacao = fl.cod_contaclassificacao

    left join finformapagamento ffp
      on ffp.cod_formapagamento = fp.cod_formapagamento

    /* Empresa do lançamento */
    join pessoa pe_emp
      on pe_emp.cod_pessoa = fl.cod_empresa

    /* Pessoa cliente/fornecedor */
    join pessoa p_cli
      on p_cli.cod_pessoa = fl.cod_pessoa

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
  and fp.datavencimento between cast(? as date) and cast(? as date)

order by
  fp.datavencimento,
  fl.cod_lancamento,
  fp.cod_lancamentoparcela;
