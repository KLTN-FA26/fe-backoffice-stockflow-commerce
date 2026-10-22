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
  /** Mã lỗi của từng trường (BE `fieldErrors[].code`) khi có — để rẽ nhánh theo mã thay vì theo câu chữ. */
  readonly fieldCodes?: Record<string, string>;
  /**
   * `fieldErrors[]` nguyên dạng của BE khi là mảng. `fieldErrors` / `fieldCodes` chỉ giữ phần tử đầu của mỗi trường;
   * lỗi có nhiều phần tử cùng một trường (vd mỗi đơn vi phạm LP-4 một `orderNumber`) đọc ở đây.
   */
  readonly fieldErrorList?: readonly ApiFieldErrorBody[];

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string>,
    traceId?: string,
    fieldCodes?: Record<string, string>,
    fieldErrorList?: readonly ApiFieldErrorBody[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.traceId = traceId;
    this.fieldCodes = fieldCodes;
    this.fieldErrorList = fieldErrorList;
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
      normalizeFieldCodes(data?.fieldErrors),
      Array.isArray(data?.fieldErrors) ? data.fieldErrors : undefined,
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

/** Mã lỗi theo trường từ dạng mảng `fieldErrors[{ field, message, code }]`; dạng bản đồ không có mã. */
function normalizeFieldCodes(
  errors: ApiErrorBody["fieldErrors"],
): Record<string, string> | undefined {
  if (!errors || !Array.isArray(errors)) return undefined;
  const codes: Record<string, string> = {};
  for (const error of errors) {
    if (error.code && !(error.field in codes)) codes[error.field] = error.code;
  }
  return Object.keys(codes).length > 0 ? codes : undefined;
}
