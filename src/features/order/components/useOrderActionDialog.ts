"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { toast } from "@/components/shared/Toast";

import { ORDER_STALE_ERROR_CODES, orderActionErrorView } from "../errors";
import { orderKeys } from "../queries";

import type { ApiError } from "@/lib/api/error";
import type { OrderStatusActionKey } from "../errors";

/** Kiểu nút thao tác ở card trạng thái (dùng chung các thao tác đơn). */
export const ORDER_ACTION_BUTTON =
  "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted w-full rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium";

export function toReasonOptions<const K extends string>(
  keys: readonly K[],
  labels: Record<K, string>,
): { value: K; label: string }[] {
  return keys.map((value) => ({ value, label: labels[value] }));
}

/**
 * Trạng thái dialog + xử lý lỗi chung của các thao tác. Lỗi do dữ liệu cũ (đơn đã đổi trạng thái)
 * → đóng dialog, tải lại đơn, báo qua toast; lỗi khác giữ dialog + dữ liệu đã nhập, hiện tại chỗ.
 */
export function useOrderActionDialog(action: OrderStatusActionKey) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const hookOptions = {
    onSuccess: () => setOpen(false),
    onError: (apiError: ApiError) => {
      const view = orderActionErrorView(apiError, action);
      const detail = view.traceId
        ? `${view.detail} (${UI_LABELS.common.traceId}: ${view.traceId})`
        : view.detail;
      if (ORDER_STALE_ERROR_CODES.includes(apiError.code)) {
        setOpen(false);
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
        toast.error(view.title, detail);
      } else {
        setError(detail);
      }
    },
  };

  return {
    open,
    error,
    hookOptions,
    show: () => {
      setError(null);
      setOpen(true);
    },
    close: () => setOpen(false),
  };
}
