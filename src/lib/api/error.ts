/**
 * Normalised API error.
 *
 * Every axios error is converted into an ApiError so consuming code never
 * needs to inspect raw AxiosError shapes.
 *
 * `fieldErrors` (when present) keeps the server's field names verbatim (`{ field: message }`).
 * Each form maps the server fields it recognises explicitly (e.g. `ServerFieldMap` in
 * `features/order/errors.ts`, `poCreateFieldErrors`) — never cast an arbitrary server field name to
 * a form path type; unknown fields go to the form's general error instead.
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

/**
 * BE `ApiResponse.fieldErrors`: `[{ field, message, code? }]` (field đầu tiên thắng). Phần tử sai
 * hình (không phải object, thiếu / không phải chuỗi `field` hoặc `message`) bị bỏ — body lỗi đến từ
 * mạng, không được làm hỏng luồng xử lý lỗi.
 */
function normalizeFieldErrors(errors: unknown): Record<string, string> | undefined {
  if (typeof errors !== "object" || errors === null) return undefined;
  const entries: [unknown, unknown][] = Array.isArray(errors)
    ? errors.map((error: unknown) =>
        typeof error === "object" && error !== null && "field" in error && "message" in error
          ? [error.field, error.message]
          : [undefined, undefined],
      )
    : Object.entries(errors);

  const normalized: Record<string, string> = {};
  for (const [field, message] of entries) {
    if (typeof field !== "string" || field === "" || typeof message !== "string") continue;
    if (!Object.hasOwn(normalized, field)) normalized[field] = message;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/** Mã lỗi theo trường từ dạng mảng `fieldErrors[{ field, message, code }]`; dạng bản đồ không có mã. */
function normalizeFieldCodes(
  errors: ApiErrorBody["fieldErrors"],
): Record<string, string> | undefined {
  if (!errors || !Array.isArray(errors)) return undefined;
  const codes: Record<string, string> = {};
  // Body lỗi đến từ mạng có thể sai hình (phần tử null / chuỗi) — bỏ qua thay vì vỡ
  for (const error of errors as unknown[]) {
    if (typeof error !== "object" || error === null) continue;
    const { field, code } = error as Partial<ApiFieldErrorBody>;
    if (typeof field !== "string" || typeof code !== "string" || !code) continue;
    if (!Object.hasOwn(codes, field)) codes[field] = code;
  }
  return Object.keys(codes).length > 0 ? codes : undefined;
}
