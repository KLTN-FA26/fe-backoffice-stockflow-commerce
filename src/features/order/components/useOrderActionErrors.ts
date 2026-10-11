"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { toast } from "@/components/shared/Toast";

import { orderKeys } from "../queries";

import type { ApiError } from "@/lib/api/error";
import type { OrderErrorView } from "../errors";

/**
 * Lỗi của dialog thao tác đơn (release / duyệt công nợ / huỷ), một chỗ cho mọi dialog:
 * - Mã trong `staleCodes` = dữ liệu trên màn đã cũ (đơn đã đổi trạng thái, người khác đã xử lý)
 *   → đóng dialog, toast, tải lại toàn bộ dữ liệu đơn (`orderKeys.all`) để nút tự ẩn.
 * - Lỗi còn lại → giữ dialog + dữ liệu đã nhập, hiện lý do (mã BR, traceId) ngay trong dialog.
 */
export function useOrderActionErrors(
  toView: (error: ApiError) => OrderErrorView,
  staleCodes: readonly string[],
  onClose: () => void,
) {
  const queryClient = useQueryClient();
  const [refusal, setRefusal] = useState<OrderErrorView | null>(null);

  const onError = (error: ApiError) => {
    const view = toView(error);
    if (staleCodes.includes(error.code)) {
      onClose();
      toast.error(view.title, view.detail);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      return;
    }
    setRefusal(view);
  };

  return { refusal, clearRefusal: () => setRefusal(null), onError };
}

/** Mã "dữ liệu cũ" theo thao tác — BE ErrorCode (develop). */
export const STALE_CODES = {
  release: ["CONFLICT", "NOT_FOUND"],
  credit: ["ORDER_NOT_ON_CREDIT_HOLD", "NOT_FOUND"],
  cancel: ["ORDER_NOT_CANCELLABLE", "CONFLICT", "NOT_FOUND"],
} as const satisfies Record<string, readonly string[]>;
