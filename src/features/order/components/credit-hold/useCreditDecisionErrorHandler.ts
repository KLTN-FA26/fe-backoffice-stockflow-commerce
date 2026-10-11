"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { toast } from "@/components/shared/Toast";

import { creditDecisionErrorView } from "../../errors";
import { orderKeys } from "../../queries";

import type { ApiError } from "@/lib/api/error";
import type { OrderErrorView } from "../../errors";

/** Đơn đã được người khác xử lý / không còn trong phạm vi → dữ liệu trên màn đã cũ. */
const STALE_ERROR_CODES: readonly string[] = ["ORDER_NOT_ON_CREDIT_HOLD", "NOT_FOUND"];

/**
 * Lỗi duyệt / từ chối vượt hạn mức: dữ liệu cũ → đóng dialog, báo và tải lại danh sách + đơn;
 * lỗi còn lại (thiếu ghi chú, phương thức không được phép, mạng) → hiện trong dialog để sửa.
 */
export function useCreditDecisionErrorHandler(onClose: () => void) {
  const queryClient = useQueryClient();
  const [refusal, setRefusal] = useState<OrderErrorView | null>(null);

  const onError = (error: ApiError) => {
    const view = creditDecisionErrorView(error);
    if (STALE_ERROR_CODES.includes(error.code)) {
      onClose();
      toast.error(view.title, view.detail);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      return;
    }
    setRefusal(view);
  };

  return { refusal, setRefusal, onError };
}
