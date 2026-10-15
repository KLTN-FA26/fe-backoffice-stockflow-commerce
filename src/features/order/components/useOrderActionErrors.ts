"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useIdempotencyAttempt } from "@/lib/api/idempotency";

import { toast } from "@/components/shared/Toast";

import { isOrderConcurrencyError, mapServerFieldErrors } from "../errors";
import { orderKeys } from "../queries";

import type { ApiError } from "@/lib/api/error";
import type { OrderErrorView, ServerFieldMap } from "../errors";

/** Gắn `fieldErrors` của BE vào form của dialog (react-hook-form `setError`). */
export interface ServerFieldErrorTarget<F extends string> {
  map: ServerFieldMap<F>;
  setError: (field: F, message: string) => void;
}

/**
 * Lỗi của dialog thao tác đơn (release / duyệt công nợ / huỷ), một chỗ cho mọi dialog. Thứ tự:
 * 0. Mã nghiệp vụ riêng của form (vd PAYMENT_TERM_NOT_ALLOWED) — form xử lý TRƯỚC khi gọi đây.
 * 1. Mã trong `staleCodes` = dữ liệu trên màn đã cũ (đơn đã đổi trạng thái, người khác đã xử lý)
 *    → đóng dialog, toast, tải lại toàn bộ dữ liệu đơn (`orderKeys.all`) để nút tự ẩn.
 * 2. Tranh chấp đồng thời (OPTIMISTIC_LOCK / LOCK_TIMEOUT / IDEMPOTENT_REQUEST_IN_PROGRESS) →
 *    giữ dialog + dữ liệu đã nhập, báo trong dialog; OPTIMISTIC_LOCK tải lại `orderKeys.all` (đơn
 *    đã đổi). KHÔNG tự gửi lại — người dùng bấm lại.
 * 3. `fieldErrors` của BE → lỗi tại ô (mọi field nhận ra); field lạ → kèm vào thông báo chung.
 * 4. Còn lại → giữ dialog + dữ liệu đã nhập, hiện lý do (mã BR, traceId) ngay trong dialog.
 *
 * Idempotency-Key: một "lần thử logic" theo dialog (`idempotencyKeyFor(variables)`) — mọi lỗi được
 * `settle` TRƯỚC các bước trên: BE đã chốt kết quả (hay KEY_REUSED) → bỏ key; BE nhả claim (409,
 * 5xx, mất mạng) → giữ key cho lần bấm lại cùng nội dung. Thành công → `finishAttempt`.
 */
export function useOrderActionErrors<F extends string>(
  toView: (error: ApiError) => OrderErrorView,
  staleCodes: readonly string[],
  onClose: () => void,
  fields?: ServerFieldErrorTarget<F>,
) {
  const queryClient = useQueryClient();
  const [refusal, setRefusal] = useState<OrderErrorView | null>(null);
  const attempt = useIdempotencyAttempt();

  const onError = (error: ApiError) => {
    attempt.settle(error);
    const view = toView(error);
    if (staleCodes.includes(error.code)) {
      onClose();
      toast.error(view.title, view.detail);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      return;
    }
    if (isOrderConcurrencyError(error)) {
      // LOCK_TIMEOUT: giao dịch của mình chưa ghi gì, người khác còn giữ khoá → không tải lại vội
      if (error.code === "OPTIMISTIC_LOCK") {
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      }
      setRefusal(view);
      return;
    }
    if (fields) {
      const { mapped, unmapped } = mapServerFieldErrors(error, fields.map);
      for (const { field, message } of mapped) fields.setError(field, message);
      if (unmapped.length > 0) {
        setRefusal({ ...view, serverDetail: unmapped.join(" · ") });
        return;
      }
    }
    setRefusal(view);
  };

  return {
    refusal,
    clearRefusal: () => setRefusal(null),
    onError,
    /** Key cho đúng biến mutation này (cùng nội dung → cùng key). */
    idempotencyKeyFor: attempt.keyFor,
    /** Gọi khi thành công — lần thử logic đã xong. */
    finishAttempt: attempt.reset,
  };
}

/** Mã "dữ liệu cũ" theo thao tác — BE ErrorCode (develop). */
export const STALE_CODES = {
  release: ["CONFLICT", "NOT_FOUND"],
  credit: ["ORDER_NOT_ON_CREDIT_HOLD", "NOT_FOUND"],
  cancel: ["ORDER_NOT_CANCELLABLE", "CONFLICT", "NOT_FOUND"],
} as const satisfies Record<string, readonly string[]>;
