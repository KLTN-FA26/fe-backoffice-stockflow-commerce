"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { createIdempotencyAttempt } from "@/lib/api/idempotency";

import { toast } from "@/components/shared/Toast";

import { ORDER_STALE_ERROR_CODES, isOrderConcurrencyError, mapServerFieldErrors } from "../errors";
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
  // Một lần thử logic theo vòng đời dialog (form chỉ mount khi mở → đóng là bỏ key)
  const [attempt] = useState(() => createIdempotencyAttempt());
  // Chặn gửi lặp (double-click / Enter lặp): `isPending` chỉ đổi ở lần render sau, nên cú bấm thứ
  // hai trước lúc đó vẫn lọt qua `FormDialogBody` → 2 request cùng key. Ref đổi ngay, đồng bộ.
  const inFlight = useRef(false);

  const onError = (error: ApiError) => {
    inFlight.current = false;
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
    /** Bắt đầu một lần gửi; `false` = request trước của dialog chưa có kết quả → bỏ qua cú bấm này. */
    beginSubmit: () => {
      if (inFlight.current) return false;
      inFlight.current = true;
      return true;
    },
    /** Key cho đúng biến mutation này (cùng nội dung → cùng key). */
    idempotencyKeyFor: attempt.keyFor,
    /** Gọi khi thành công — lần thử logic đã xong. */
    finishAttempt: () => {
      inFlight.current = false;
      attempt.reset();
    },
  };
}

/**
 * Mã "dữ liệu cũ" theo thao tác — một danh sách chung `ORDER_STALE_ERROR_CODES` (errors.ts, BE
 * ErrorCode 5683fe14): release từ trạng thái khác Confirmed trả ORDER_INVALID_TRANSITION; huỷ đơn đã
 * đóng gói trả ORDER_NOT_CANCELLABLE; người khác đã quyết công nợ trả ORDER_NOT_ON_CREDIT_HOLD. KHÔNG
 * gồm LOCK_TIMEOUT / ORDER_BALANCE_NOT_PAID / PAYMENT_TERM_NOT_ALLOWED (không phải dữ liệu cũ).
 */
export const STALE_CODES = {
  release: ORDER_STALE_ERROR_CODES,
  credit: ORDER_STALE_ERROR_CODES,
  cancel: ORDER_STALE_ERROR_CODES,
} as const satisfies Record<string, readonly string[]>;
