/**
 * Normalised API error.
 *
 * Every axios error is converted into an ApiError so consuming code never
 * needs to inspect raw AxiosError shapes.
 *
 * `fieldErrors` (when present) maps directly to react-hook-form `setError`:
 *   for (const [k, msg] of Object.entries(e.fieldErrors))
 *     form.setError(k as Path<T>, { type: "server", message: msg });
 */

import { type AxiosError } from "axios";

export interface ApiFieldErrorBody {
  code?: string;
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code?: string;
  errorCode?: string;
  message?: string;
  fieldErrors?: ApiFieldErrorBody[] | Record<string, string>;
  correlationId?: string;
  traceId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;
  readonly traceId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string>,
    traceId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.traceId = traceId;
  }

  /** Create from an AxiosError (used in response interceptor). */
  static from(err: AxiosError<ApiErrorBody>): ApiError {
    const data = err.response?.data;
    const status = err.response?.status ?? 0;

    if (!err.response) {
      // Network error / timeout
      return new ApiError(
        0,
        "NETWORK_ERROR",
        "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
      );
    }

    return new ApiError(
      status,
      data?.errorCode ?? data?.code ?? `HTTP_${status}`,
      data?.message ?? err.message ?? "Đã xảy ra lỗi",
      normalizeFieldErrors(data?.fieldErrors),
      data?.correlationId ?? data?.traceId,
    );
  }

  /** True for client errors that should NOT be retried. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

function normalizeFieldErrors(
  errors: ApiErrorBody["fieldErrors"],
): Record<string, string> | undefined {
  if (!errors) return undefined;
  if (!Array.isArray(errors)) return errors;

  const normalized: Record<string, string> = {};
  for (const error of errors) {
    if (!(error.field in normalized)) normalized[error.field] = error.message;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
