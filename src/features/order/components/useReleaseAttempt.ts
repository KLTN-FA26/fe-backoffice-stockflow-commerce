"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { toast } from "@/components/shared/Toast";

import {
  isReleaseConcurrencyError,
  RELEASE_STALE_CODES,
  releaseErrorView,
  releaseFieldErrors,
} from "../release-errors";
import { orderKeys } from "../queries";

import type { ApiError } from "@/lib/api/error";
import type { OrderErrorView } from "../errors";

/**
 * Một lần thử release của hộp thoại: lý do từ chối + `Idempotency-Key`. Thứ tự xử lý lỗi:
 * 0. `settle` key theo lỗi: BE đã chốt kết quả (400 / 403…) hay KEY_REUSED → bỏ key; BE nhả claim (409, 5xx, mất
 *    mạng) → GIỮ key cho lần bấm lại cùng nội dung (nếu lần trước thật ra đã xong, BE trả kết quả cũ).
 * 1. Mã "dữ liệu cũ" (đơn đã đổi trạng thái) → đóng hộp thoại, toast, tải lại đơn.
 * 2. Tranh chấp đồng thời (OPTIMISTIC_LOCK / LOCK_TIMEOUT / IN_PROGRESS) → giữ hộp thoại + dữ liệu, báo tại chỗ;
 *    OPTIMISTIC_LOCK tải lại đơn (đã đổi); KHÔNG tự gửi lại.
 * 3. 400 `warehouseId` → lỗi ngay tại ô Kho (`setWarehouseError`); lỗi trường khác vẫn hiện thành lý do chung.
 * 4. Còn lại → lý do (mã quy tắc, SKU, traceId) trong hộp thoại.
 * Form chỉ mount khi hộp thoại mở nên đóng hộp thoại là bỏ cả key.
 */
export function useReleaseAttempt(onClose: () => void) {
  const queryClient = useQueryClient();
  const [refusal, setRefusal] = useState<OrderErrorView | null>(null);
  const [attempt] = useState(() => createIdempotencyAttempt());

  const onError = (error: ApiError, setWarehouseError: (message: string) => void) => {
    attempt.settle(error);
    const view = releaseErrorView(error);
    if (RELEASE_STALE_CODES.includes(error.code)) {
      onClose();
      toast.error(view.title, view.detail);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      return;
    }
    if (isReleaseConcurrencyError(error)) {
      if (error.code === "OPTIMISTIC_LOCK")
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      setRefusal(view);
      return;
    }
    const { warehouseId } = releaseFieldErrors(error);
    if (warehouseId) {
      setWarehouseError(warehouseId);
      // Chỉ lỗi ô kho → để ô báo; còn lỗi trường khác BE nêu → vẫn hiện lý do chung
      if (Object.keys(error.fieldErrors ?? {}).every((field) => field === "warehouseId")) return;
    }
    setRefusal(view);
  };

  return {
    refusal,
    clearRefusal: () => setRefusal(null),
    onError,
    /** Key cho đúng yêu cầu này (cùng nội dung → cùng key). */
    idempotencyKeyFor: attempt.keyFor,
    /** Gọi khi thành công — lần thử logic đã xong. */
    finishAttempt: attempt.reset,
  };
}
