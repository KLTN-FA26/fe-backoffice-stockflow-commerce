"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { UI_LABELS } from "@/constants";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
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
 * Gửi qua `submit` → kèm Idempotency-Key của lần thử + chặn gửi lặp (thao tác trả `OrderResponse`).
 */
export function useOrderActionDialog(action: OrderStatusActionKey) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // Một "lần thử logic" mỗi lần mở dialog (cùng phạm vi với dialog huỷ / release): cùng nội dung bấm
  // lại sau lỗi tạm thời → cùng Idempotency-Key; nội dung khác → key mới; thành công → bỏ key.
  const [attempt] = useState(() => createIdempotencyAttempt());
  // Chặn gửi lặp (double-click / Enter lặp) — như `useOrderActionErrors.beginSubmit`: `isPending` chỉ
  // đổi ở lần render sau, nên cú bấm thứ hai trước lúc đó vẫn gửi request thứ hai (cùng key, BE replay).
  const inFlight = useRef(false);

  const hookOptions = {
    onSuccess: () => {
      inFlight.current = false;
      attempt.reset();
      setOpen(false);
    },
    onError: (apiError: ApiError) => {
      inFlight.current = false;
      // BE đã chốt kết quả / key bị dùng sai → bỏ key; BE nhả claim (409, 5xx, mạng) → giữ key
      attempt.settle(apiError);
      const view = orderActionErrorView(apiError, action);
      const detail = view.traceId
        ? `${view.detail} (${UI_LABELS.common.traceId}: ${view.traceId})`
        : view.detail;
      if (ORDER_STALE_ERROR_CODES.includes(apiError.code)) {
        setOpen(false);
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
        toast.error(view.title, detail);
      } else {
        // Bản ghi đã bị người khác ghi trước → tải lại đơn, giữ dialog + dữ liệu đã nhập
        if (apiError.code === "OPTIMISTIC_LOCK") {
          void queryClient.invalidateQueries({ queryKey: orderKeys.all });
        }
        setError(detail);
      }
    },
  };

  return {
    open,
    error,
    hookOptions,
    /**
     * Gửi một lần: bỏ qua khi request trước của dialog chưa có kết quả. Biến mutation kèm
     * Idempotency-Key của lần thử hiện tại (header, không vào body).
     */
    submit: <T extends object>(
      mutate: (variables: T & { idempotencyKey: string }) => void,
      variables: T,
    ) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutate({ ...variables, idempotencyKey: attempt.keyFor(variables) });
    },
    show: () => {
      inFlight.current = false;
      attempt.reset();
      setError(null);
      setOpen(true);
    },
    close: () => setOpen(false),
  };
}
