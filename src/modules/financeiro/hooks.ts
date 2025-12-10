import { useApiQuery } from "@/hooks/useApiQuery";
import { apiGet } from "@/lib/apiClient";
import type {
  FinanceiroPeriodoParams,
  FinanceiroParcela,
  FinanceiroDreLinha,
} from "@/services/financeiroService";

export function useFinanceiroParcelasQuery(params: FinanceiroPeriodoParams) {
  return useApiQuery<FinanceiroParcela[], FinanceiroPeriodoParams>(
    {
      key: "financeiro-parcelas",
      path: "/financeiro/parcelas",
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

export function useFinanceiroDreQuery(params: FinanceiroPeriodoParams) {
  return useApiQuery<FinanceiroDreLinha[], FinanceiroPeriodoParams>(
    {
      key: "financeiro-dre",
      path: "/financeiro/dre",
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
