// src/services/estoqueService.ts

import { apiGet } from "@/lib/apiClient";

export interface EstoqueAnaliseParams {
  empresa: number | string;
}

export interface EstoqueAnaliseItem {
  cod_empresa?: number;
  empresa?: string;

  cod_item?: number;
  descricao_item?: string;

  quantidade_estoque?: number;
  saldo_estoque?: number;
  estoque_minimo?: number;
  estoque_maximo?: number;

  data_ultima_entrada?: string | null;
  data_ultima_movimentacao?: string | null;
  dias_estoque?: number | null;

  caf?: number | null;
  cobertura_minimo?: number | null;

  acao?: string;
  acao_sugerida?: string;

  fornecedor_cod_pessoa?: number;
  fornecedor_nome?: string;

  [key: string]: any;
}

/**
 * GET /estoque/analise-acao
 */
export async function fetchEstoqueAnaliseAcao(
  params: EstoqueAnaliseParams
): Promise<EstoqueAnaliseItem[]> {
  // no bridge o controller aceita codEmpresa ou empresa;
  // aqui mandamos codEmpresa explicitamente
  return apiGet<EstoqueAnaliseItem[]>("/estoque/analise-acao", {
    codEmpresa: params.empresa,
  });
}
