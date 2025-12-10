// src/modules/estoque/hooks.ts

import { useApiQuery } from "@/hooks/useApiQuery";
import { apiGet } from "@/lib/apiClient";
import type {
  EstoqueAnaliseParams,
  EstoqueAnaliseItem,
} from "@/services/estoqueService";

/**
 * Hook para /estoque/analise-acao
 */
export function useEstoqueAnaliseAcaoQuery(params: EstoqueAnaliseParams) {
  return useApiQuery<EstoqueAnaliseItem[], EstoqueAnaliseParams>(
    {
      key: "estoque-analise-acao",
      path: "/estoque/analise-acao",
      params,
      mapParams: (p) => ({
        codEmpresa: p.empresa,
      }),
      enabled: Boolean(params.empresa),
    },
    apiGet
  );
}
