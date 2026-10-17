/**
 * Tiện ích dùng chung cho các route mock theo hợp đồng BE (response không bọc envelope — interceptor
 * của client xử lý cả hai dạng). File mock mới dùng ở đây thay vì tự khai báo lại.
 */

import type { AxiosRequestConfig } from "axios";

export interface MockResponseShape {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

/**
 * BE `application.yml` có `default-property-inclusion: non_null`: trường chưa đặt bị BỎ KHỎI JSON chứ
 * không gửi `null`. Mock phải giống vậy để schema FE (`.nullish()`) và test chạm đúng trường hợp "vắng".
 * Danh sách rỗng vẫn được gửi (`[]`).
 */
export function omitNulls<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => omitNulls(item)) as T;
  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, omitNulls(v)]),
    ) as T;
  }
  return value;
}

export const ok = (data: unknown, status = 200): MockResponseShape => ({
  status,
  data: omitNulls(data),
  headers: {},
});

export const noContent = (): MockResponseShape => ({ status: 204, data: null, headers: {} });

/** Lỗi theo `ApiErrorBody` của BE: `errorCode`, `message`, `fieldErrors[]`. */
export const fail = (
  status: number,
  errorCode: string,
  message: string,
  fieldErrors: { field: string; message: string; code?: string }[] = [],
): MockResponseShape => ({
  status,
  data: { success: false, errorCode, message, fieldErrors },
  headers: {},
});

export const validationFailed = (field: string, message: string): MockResponseShape =>
  fail(400, "VALIDATION_FAILED", message, [{ field, message }]);

export const optimisticLock = (): MockResponseShape =>
  fail(409, "OPTIMISTIC_LOCK", "The record changed meanwhile, please retry");

const decode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Tham số đường dẫn (`:id`…) do mock adapter gắn vào config. Adapter khớp trên URL còn mã hoá phần
 * trăm (`encodeURIComponent` của các file `api.ts` của feature), còn Spring giải mã trước khi vào controller —
 * nên giải mã ở đây để id có ký tự đặc biệt (vd `ATTR-SIZE:L`) hoạt động như trên BE thật.
 */
export const pathParams = (config: AxiosRequestConfig): Record<string, string> =>
  Object.fromEntries(
    Object.entries(
      ((config as Record<string, unknown>)._mockParams as Record<string, string> | undefined) ?? {},
    ).map(([key, value]) => [key, decode(value)]),
  );

/** Body JSON (axios có thể đã stringify). */
export function bodyOf(config: AxiosRequestConfig): Record<string, unknown> {
  if (typeof config.data === "string") {
    try {
      const parsed: unknown = JSON.parse(config.data);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return config.data && typeof config.data === "object"
    ? (config.data as Record<string, unknown>)
    : {};
}

export const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Query string đã được adapter gắn vào `config.url`. */
export function queryOf(config: AxiosRequestConfig): URLSearchParams {
  if (config.params instanceof URLSearchParams) return new URLSearchParams(config.params);
  return new URLSearchParams(config.url?.split("?")[1] ?? "");
}

/** BE `PageResponse` — trang đánh số từ 0. */
export function pageOf<T>(items: readonly T[], page: number, size: number) {
  const totalElements = items.length;
  const totalPages = size > 0 ? Math.ceil(totalElements / size) : 0;
  return {
    items: items.slice(page * size, page * size + size),
    page,
    size,
    totalElements,
    totalPages,
    hasNext: page + 1 < totalPages,
    hasPrevious: page > 0,
  };
}

/** Bỏ dấu + chuẩn hoá thành mã A-Z0-9 ngăn bằng `-` (dùng cho mã giá trị mock). */
export function slugCode(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}
