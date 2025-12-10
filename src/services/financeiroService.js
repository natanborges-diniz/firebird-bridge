// src/services/financeiroService.ts

import { apiGet } from "@/lib/apiClient";

export interface FinanceiroPeriodoParams {
  empresa: number | string;
  dataInicio: string; // 'YYYY-MM-DD'
  dataFim: string;    // 'YYYY-MM-DD'
}

export interface FinanceiroParcela {
  cod_empresa: number;
  empresa_nome: string;
  cod_lancamento: number;
  lancamento_pagar: "T" | "F" | string;
  lancamento_previsao: "T" | "F" | string;
  lancamento_documento: string | null;

  pessoa_cod_pessoa: number;
  pessoa_nome: string;

  parcela_id: number;
  parcela_data_emissao: string | null;
  parcela_data_vencimento: string | null;
  parcela_data_pagamento: string | null;
  parcela_data_recebimento: string | null;
  parcela_valor: number;
  parcela_valor_original: number;
  parcela_valor_pago: number;

  parcela_situacao: string;

  contacla_codigo: number | null;
  contacla_numero: string | null;
  contacla_descricao: string | null;

  formapagto_codigo: number | null;
  formapagto_tipo_codigo: number | null;
  formapagto_tipo_nome: string | null;

  [key: string]: any;
}

export type FinanceiroDreLinha = Record<string, any>;

/**
 * GET /financeiro/parcelas
 */
export async function fetchFinanceiroParcelas(
  params: FinanceiroPeriodoParams
): Promise<FinanceiroParcela[]> {
  return apiGet<FinanceiroParcela[]>("/financeiro/parcelas", {
    empresa: params.empresa,
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  });
}

/**
 * GET /financeiro/dre
 * (ajuste o path se estiver diferente no bridge)
 */
export async function fetchFinanceiroDre(
  params: FinanceiroPeriodoParams
): Promise<FinanceiroDreLinha[]> {
  return apiGet<FinanceiroDreLinha[]>("/financeiro/dre", {
    empresa: params.empresa,
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  });
}
