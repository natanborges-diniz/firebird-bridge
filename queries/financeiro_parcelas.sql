select
  *
from
  VW_FIN_PARCELAS_COMPLETO
where
  data_emissao between ? and ?
  and cod_empresa = ?
order by
  data_emissao,
  cod_lancamento;
