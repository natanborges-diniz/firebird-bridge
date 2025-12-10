// src/services/vendasService.ts

import { apiGet } from "@/lib/apiClient";

export interface VendasPeriodoParams {
  empresa: number | string;
  dataInicio: string; // 'YYYY-MM-DD'
  dataFim: string;    // 'YYYY-MM-DD'
}

export interface VendasResumoEmpresaVendedor {
  empresa_cod_logico: number;
  empresa_nome_logico: string;
  cod_vendedor: number;
  vendedor_nome: string;
  total_bruto?: number;
  total_liquido?: number;
  qtd_vendas?: number;
  ticket_medio?: number;
  [key: string]: any;
}

export interface VendasResumoFormaPagamento {
  empresa_cod_logico: number;
  empresa_nome_logico: string;
  formapagto_tipo_codigo?: number;
  formapagto_tipo_nome?: string;
  total_bruto?: number;
  total_liquido?: number;
  qtd_vendas?: number;
  [key: string]: any;
}

export interface VendasAnaliseFamiliaVendedor {
  empresa_cod_logico: number;
  empresa_nome_logico: string;
  cod_vendedor: number;
  vendedor_nome: string;
  familia?: string;
  qtd_transacao?: number;
  qtd_produtos?: number;
  total_vendido?: number;
  [key: string]: any;
}

/**
 * GET /vendas/resumo-empresa-vendedor
 */
export async function fetchVendasResumoEmpresaVendedor(
  params: VendasPeriodoParams
): Promise<VendasResumoEmpresaVendedor[]> {
  return apiGet<VendasResumoEmpresaVendedor[]>("/vendas/resumo-empresa-vendedor", {
    empresa: params.empresa,
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  });
}

/**
 * GET /vendas/resumo-formas-pagamento
 */
export async function fetchVendasResumoFormasPagamento(
  params: VendasPeriodoParams
): Promise<VendasResumoFormaPagamento[]> {
  return apiGet<VendasResumoFormaPagamento[]>("/vendas/resumo-formas-pagamento", {
    empresa: params.empresa,
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  });
}

/**
 * GET /vendas/analise-familia-vendedor
 */
export async function fetchVendasAnaliseFamiliaVendedor(
  params: VendasPeriodoParams
): Promise<VendasAnaliseFamiliaVendedor[]> {
  return apiGet<VendasAnaliseFamiliaVendedor[]>("/vendas/analise-familia-vendedor", {
    empresa: params.empresa,
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  });
}
