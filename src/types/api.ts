// src/types/api.ts

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: ApiError | null;
}
