/**
 * `Idempotency-Key` cho thao tác ghi — gương BE `common/idempotency/IdempotencyFilter` (develop).
 *
 * BE (mô hình Stripe, mọi POST/PUT/PATCH/DELETE có header — không cấu hình theo endpoint):
 * - Khoá theo (key, người gọi); vân tay = method + path?query + body (byte). Cùng key mà khác vân
 *   tay → 422 IDEMPOTENCY_KEY_REUSED. Bản gốc chưa xong → 409 IDEMPOTENT_REQUEST_IN_PROGRESS.
 * - Kết quả "đã chốt" (mọi status < 500 trừ 408/409/423/425/429) được LƯU 24 giờ và trả lại y
 *   nguyên cho request trùng — kể cả 400 / 403 / 404.
 * - 408/409/423/425/429 và 5xx (cả OPTIMISTIC_LOCK, LOCK_TIMEOUT, lỗi nghiệp vụ 409) bị NHẢ —
 *   cùng key chạy lại thật.
 *
 * Vòng đời key phía FE (một "lần thử logic" = một nội dung request):
 * - Cùng nội dung + lần trước bị nhả (hoặc mất mạng, không biết BE đã chạy chưa) → GIỮ key: bấm lại
 *   an toàn — nếu lần trước thật ra đã xong, BE trả lại kết quả cũ thay vì làm lần hai.
 * - Thành công, lỗi đã chốt, hoặc KEY_REUSED → BỎ key: lần bấm sau là yêu cầu mới, không bị trả
 *   lại mãi một lỗi đã lưu (vd 403 trước khi được cấp quyền).
 * - Nội dung đổi → key mới (không bao giờ thành KEY_REUSED vì người dùng sửa form).
 * Không tự gửi lại — mỗi lần bấm là đúng một request.
 */

import { useState } from "react";

import type { AxiosRequestConfig } from "axios";
import type { ApiError } from "./error";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** UUID ngẫu nhiên an toàn mật mã — hợp lệ với BE (8–255 ký tự `[A-Za-z0-9-_:.]`). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Config axios chỉ cho MỘT request — không đụng header mặc định của client. */
export function idempotencyRequestConfig(key: string | undefined): AxiosRequestConfig | undefined {
  return key ? { headers: { [IDEMPOTENCY_KEY_HEADER]: key } } : undefined;
}

/** Status BE nhả claim (`IdempotencyFilter#isStorable` = false) — cùng key còn chạy lại được. */
const RELEASED_STATUSES: ReadonlySet<number> = new Set([408, 409, 423, 425, 429]);

/**
 * Lần thử còn dùng tiếp key cũ được không. Mất mạng (status 0) → giữ: không biết BE đã xử lý chưa,
 * giữ key thì bấm lại không thể làm hai lần.
 */
export function idempotencyKeyStillUsable(error: Pick<ApiError, "status" | "code">): boolean {
  if (error.code === "IDEMPOTENCY_KEY_REUSED") return false;
  return error.status === 0 || error.status >= 500 || RELEASED_STATUSES.has(error.status);
}

/** JSON với key sắp xếp — cùng nội dung luôn ra cùng chuỗi, bất kể thứ tự thuộc tính. */
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
  /** Lần thử logic đã kết thúc (thành công) — lần sau dùng key mới. */
  reset: () => void;
  /** Cập nhật theo lỗi: bỏ key nếu BE đã chốt kết quả hoặc key bị dùng sai. */
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

/** Một lần thử logic theo vòng đời component (dialog mở → đóng = bỏ). */
export function useIdempotencyAttempt(): IdempotencyAttempt {
  const [attempt] = useState(() => createIdempotencyAttempt());
  return attempt;
}
