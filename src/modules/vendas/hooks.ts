// src/modules/vendas/hooks.ts

import { useApiQuery } from "@/hooks/useApiQuery";
import { apiGet } from "@/lib/apiClient";
import type {
  VendasPeriodoParams,
  VendasResumoEmpresaVendedor,
  VendasResumoFormaPagamento,
  VendasAnaliseFamiliaVendedor,
} from "@/services/vendasService";

/**
 * Hook para /vendas/resumo-empresa-vendedor
 */
export function useVendasResumoEmpresaVendedorQuery(
  params: VendasPeriodoParams
) {
  return useApiQuery<VendasResumoEmpresaVendedor[], VendasPeriodoParams>(
    {
      key: "vendas-resumo-empresa-vendedor",
      path: "/vendas/resumo-empresa-vendedor",
      params,
      mapParams: (p) => ({
        empresa: p.empresa,
        dataInicio: p.dataInicio,
        dataFim: p.dataFim,
      }),
      enabled: Boolean(params.empresa && params.dataInicio && params.dataFim),
    },
    apiGet
  );
}

/**
 * Hook para /vendas/resumo-formas-pagamento
 */
export function useVendasResumoFormasPagamentoQuery(
  params: VendasPeriodoParams
) {
  return useApiQuery<VendasResumoFormaPagamento[], VendasPeriodoParams>(
    {
      key: "vendas-resumo-formas-pagamento",
      path: "/vendas/resumo-formas-pagamento",
      params,
      mapParams: (p) => ({
        empresa: p.empresa,
        dataInicio: p.dataInicio,
        dataFim: p.dataFim,
      }),
      enabled: Boolean(params.empresa && params.dataInicio && params.dataFim),
    },
    apiGet
  );
}

/**
 * Hook para /vendas/analise-familia-vendedor
 */
export function useVendasAnaliseFamiliaVendedorQuery(
  params: VendasPeriodoParams
) {
  return useApiQuery<VendasAnaliseFamiliaVendedor[], VendasPeriodoParams>(
    {
      key: "vendas-analise-familia-vendedor",
      path: "/vendas/analise-familia-vendedor",
      params,
      mapParams: (p) => ({
        empresa: p.empresa,
        dataInicio: p.dataInicio,
        dataFim: p.dataFim,
      }),
      enabled: Boolean(params.empresa && params.dataInicio && params.dataFim),
    },
    apiGet
  );
}
