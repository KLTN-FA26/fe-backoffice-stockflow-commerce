/**
 * Normalised API error.
 *
 * Every axios error is converted into an ApiError so consuming code never
 * needs to inspect raw AxiosError shapes.
 *
 * \`fieldErrors\` (when present) maps directly to react-hook-form \`setError\`:
 *   for (const [k, msg] of Object.entries(e.fieldErrors))
 *     form.setError(k as Path<T>, { type: "server", message: msg });
 *
 * BE contract (common/api/ApiResponse.java + FieldError.java):
 *   success: { success:true, data, timestamp }
 *   failure: { success:false, errorCode, message, fieldErrors:[{field,message,code}], correlationId, timestamp }
 * Axios wraps the HTTP body as err.response.data (= ApiResponse). This class
 * normalises both the array and the legacy record shape.
 */

import { type AxiosError } from "axios";

export interface ApiErrorBody {
  success?: boolean;
  code?: string;
  errorCode?: string;
  message?: string;
  // BE: array of {field, message, code}; legacy mock: Record<string,string>
  fieldErrors?: Record<string, string> | Array<{ field: string; message: string; code?: string }>;
  traceId?: string;
  correlationId?: string;
  // When BE returns ApiResponse envelope, fields are at top level
  data?: unknown;
}

function toFieldErrorsMap(raw: ApiErrorBody["fieldErrors"]): Record<string, string> | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const m: Record<string, string> = {};
    for (const e of raw) if (e?.field) m[e.field] = e.message ?? "";
    return Object.keys(m).length ? m : undefined;
  }
  return raw as Record<string, string>;
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
    const data = err.response?.data as ApiErrorBody | undefined;
    const status = err.response?.status ?? 0;

    if (!err.response) {
      return new ApiError(
        0,
        "NETWORK_ERROR",
        "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
      );
    }

    // Unwrap BE envelope: { success, errorCode, message, fieldErrors, correlationId }
    const code = data?.errorCode ?? data?.code ?? `HTTP_${status}`;
    const traceId = data?.correlationId ?? data?.traceId;
    return new ApiError(
      status,
      code,
      data?.message ?? err.message ?? "Đã xảy ra lỗi",
      toFieldErrorsMap(data?.fieldErrors),
      traceId,
    );
  }

  /** True for client errors that should NOT be retried. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}
