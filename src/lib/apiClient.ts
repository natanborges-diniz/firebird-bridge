// src/lib/apiClient.ts

import type { ApiEnvelope, ApiError } from "@/types/api";

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/api/v1";

type Primitive = string | number | boolean | null | undefined;

function buildQueryString(params?: Record<string, Primitive>): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    searchParams.append(key, String(value));
  });

  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export async function apiGet<TData>(
  path: string,
  params?: Record<string, Primitive>,
  baseUrl: string = DEFAULT_BASE_URL
): Promise<TData> {
  const url = `${baseUrl}${path}${buildQueryString(params)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  let json: ApiEnvelope<TData>;

  try {
    json = (await response.json()) as ApiEnvelope<TData>;
  } catch (e) {
    const error: ApiError = {
      code: "INVALID_JSON",
      message: "Não foi possível interpretar a resposta da API",
      details: { url },
      status: response.status,
    };
    throw error;
  }

  // HTTP não 2xx
  if (!response.ok) {
    const error: ApiError = json?.error ?? {
      code: "HTTP_ERROR",
      message: `Erro HTTP ${response.status}`,
      status: response.status,
      details: { url },
    };
    throw error;
  }

  // Envelope ok=false
  if (!json.ok || json.error) {
    const error: ApiError = json.error ?? {
      code: "UNKNOWN_API_ERROR",
      message: "A API retornou erro desconhecido",
      status: response.status,
      details: { url },
    };
    throw error;
  }

  return json.data as TData;
}
