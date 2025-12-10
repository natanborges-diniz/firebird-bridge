// src/modules/os/hooks.ts

import { useApiQuery } from "@/hooks/useApiQuery";
import { apiGet } from "@/lib/apiClient";
import type { OsMonitorParams, OsMonitorLinha } from "@/services/osService";

/**
 * Hook para /os/monitor
 */
export function useOsMonitorQuery(params: OsMonitorParams) {
  return useApiQuery<OsMonitorLinha[], OsMonitorParams>(
    {
      key: "os-monitor",
      path: "/os/monitor",
      params,
      mapParams: (p) => ({
        dataInicio: p.dataInicio,
        dataFim: p.dataFim,
        empresa: p.empresa,
      }),
      enabled: Boolean(params.dataInicio && params.dataFim),
    },
    apiGet
  );
}
