// src/hooks/useApiQuery.ts

import { useEffect, useState, useCallback } from "react";
import type { ApiError } from "@/types/api";

type Primitive = string | number | boolean | null | undefined;

export interface UseApiQueryResult<TData> {
  data: TData | null;
  error: ApiError | null;
  isLoading: boolean;
  isEmpty: boolean;
  refetch: () => Promise<void>;
}

export interface UseApiQueryOptions<TParams extends Record<string, Primitive>> {
  /** Identificador lógico da query (pode ser usado pra logging/debug) */
  key: string;
  /** Endpoint relativo, ex: "/financeiro/parcelas" */
  path: string;
  /** Função que converte params tipados em query string */
  mapParams: (params: TParams) => Record<string, Primitive>;
  /** Parâmetros da requisição */
  params: TParams;
  /** Se falso, não busca automaticamente */
  enabled?: boolean;
}

/**
 * Hook base para chamadas à API do bridge.
 * Assume contrato { ok, data, error } e GET com query string.
 */
export function useApiQuery<TData, TParams extends Record<string, Primitive>>(
  options: UseApiQueryOptions<TParams>,
  fetcher: (path: string, params: Record<string, Primitive>) => Promise<TData>
): UseApiQueryResult<TData> {
  const { path, params, mapParams, enabled = true } = options;

  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const runFetch = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const queryParams = mapParams(params);
      const result = await fetcher(path, queryParams);
      setData(result);
    } catch (err: any) {
      const apiError: ApiError = {
        code: err?.code ?? "UNKNOWN_ERROR",
        message: err?.message ?? "Erro inesperado ao consultar API",
        details: err?.details,
        status: err?.status,
      };
      setError(apiError);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, path, params, mapParams, fetcher]);

  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  const isEmpty = !isLoading && !error && (data == null || (Array.isArray(data) && data.length === 0));

  return {
    data,
    error,
    isLoading,
    isEmpty,
    refetch: runFetch,
  };
}
