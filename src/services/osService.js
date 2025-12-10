// src/services/osService.ts

import { apiGet } from "@/lib/apiClient";

export interface OsMonitorParams {
  dataInicio: string;       // 'YYYY-MM-DD'
  dataFim: string;          // 'YYYY-MM-DD'
  empresa?: number | string; // opcional
}

export interface OsMonitorLinha {
  produtos?: string | null;

  cod_os: number;
  os: string | number;

  total: number;

  empresa: string;
  cod_empresa_origem: number;
  codempresa?: number; // código lógico mapeado na SQL

  dataemissao: string;
  dataprevisao: string | null;

  cliente: string;
  codcliente: number;
  cpf: string | null;

  etapa: string;
  usuario: string;
  datahoraentrada: string;
  datahorasaida: string | null;

  ordemcompra?: string | null;

  telefone: string | null;

  atraso_dias: number | null;
  status_atraso: string;

  [key: string]: any;
}

/**
 * GET /os/monitor
 */
export async function fetchOsMonitor(
  params: OsMonitorParams
): Promise<OsMonitorLinha[]> {
  return apiGet<OsMonitorLinha[]>("/os/monitor", {
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
    empresa: params.empresa, // o controller aceita empresa ou codEmpresa
  });
}
