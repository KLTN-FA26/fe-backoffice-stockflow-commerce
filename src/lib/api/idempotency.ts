/**
 * `Idempotency-Key` cho thao tác ghi — gương BE `common/idempotency/IdempotencyFilter` (develop), áp cho MỌI
 * POST / PUT / PATCH / DELETE có header (không cấu hình theo endpoint; release đơn dùng được).
 *
 * BE khoá theo (key, người gọi) + vân tay (method, path, body). Cùng key mà khác vân tay → 422 IDEMPOTENCY_KEY_REUSED;
 * bản gốc chưa xong → 409 IDEMPOTENT_REQUEST_IN_PROGRESS. Kết quả đã chốt (status < 500 trừ 408 / 409 / 423 / 425 /
 * 429) được LƯU và trả lại nguyên cho request trùng — kể cả 400 / 403; các status còn lại bị NHẢ, cùng key chạy lại thật.
 *
 * Vòng đời key phía FE (một "lần thử logic" = một nội dung request):
 * - cùng nội dung và lần trước bị nhả (hoặc mất mạng, không biết BE đã chạy chưa) → GIỮ key: bấm lại an toàn, nếu lần
 *   trước thật ra đã xong thì BE trả kết quả cũ thay vì làm lần hai;
 * - thành công, lỗi đã chốt hoặc KEY_REUSED → BỎ key: lần bấm sau là yêu cầu mới, không bị trả lại mãi một lỗi đã lưu;
 * - nội dung đổi → key mới (người dùng sửa form không bao giờ thành KEY_REUSED).
 * Không tự gửi lại: mỗi lần bấm là đúng một request. Module THUẦN (không React).
 */

import type { AxiosRequestConfig } from "axios";

import type { ApiError } from "./error";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** UUID ngẫu nhiên — hợp lệ với BE (8–255 ký tự `[A-Za-z0-9-_:.]`). */
export const newIdempotencyKey = (): string => crypto.randomUUID();

/** Config axios chỉ cho MỘT request (không đụng header mặc định của client); không có key → không thêm gì. */
export function idempotencyRequestConfig(key: string | undefined): AxiosRequestConfig | undefined {
  return key ? { headers: { [IDEMPOTENCY_KEY_HEADER]: key } } : undefined;
}

/** Status BE nhả claim (`IdempotencyFilter#isStorable` = false): cùng key còn chạy lại được. */
const RELEASED_STATUSES: ReadonlySet<number> = new Set([408, 409, 423, 425, 429]);

/** Còn dùng tiếp key cũ được không. Mất mạng (status 0) → giữ: không biết BE đã xử lý chưa. */
export function idempotencyKeyStillUsable(error: Pick<ApiError, "status" | "code">): boolean {
  if (error.code === "IDEMPOTENCY_KEY_REUSED") return false;
  return error.status === 0 || error.status >= 500 || RELEASED_STATUSES.has(error.status);
}

/** JSON với khoá sắp xếp — cùng nội dung luôn ra cùng chuỗi, bất kể thứ tự thuộc tính. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export interface IdempotencyAttempt {
  /** Key cho đúng yêu cầu này: cùng nội dung → cùng key; nội dung khác → key mới. */
  keyFor: (request: unknown) => string;
  /** Lần thử logic đã kết thúc (thành công): lần sau dùng key mới. */
  reset: () => void;
  /** Theo lỗi: bỏ key nếu BE đã chốt kết quả hoặc key bị dùng sai. */
  settle: (error: Pick<ApiError, "status" | "code">) => void;
}

export function createIdempotencyAttempt(
  generate: () => string = newIdempotencyKey,
): IdempotencyAttempt {
  let current: { fingerprint: string; key: string } | null = null;
  return {
    keyFor(request) {
      const fingerprint = stableStringify(request);
      if (current?.fingerprint !== fingerprint) current = { fingerprint, key: generate() };
      return current.key;
    },
    reset() {
      current = null;
    },
    settle(error) {
      if (!idempotencyKeyStillUsable(error)) current = null;
    },
  };
}
