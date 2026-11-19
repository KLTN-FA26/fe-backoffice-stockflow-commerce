"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";
import {
  productKeys,
  productTransitionErrorMessage,
  usePublishProduct,
  useTransitionProduct,
  useUnpublishProduct,
} from "@/features/product";
import { toast } from "@/components/shared/Toast";

import type { Product, ProductAction } from "@/features/product";
import type { LifecycleDialog } from "./ProductLifecycleDialogs";

/**
 * Hành động trạng thái trên trang chi tiết: gửi duyệt / duyệt / xuất bản / gỡ chạy thẳng; từ chối,
 * tạm ngưng, tiếp tục, ngừng kinh doanh, xoá cần lý do hoặc `version` → mở `ProductLifecycleDialogs`.
 * 409 trạng thái / version cũ: mutation tự tải lại chi tiết (`withStaleRefetch`).
 */
export function useProductStatusActions(product: Product | null) {
  const transitionMutation = useTransitionProduct();
  const publishMutation = usePublishProduct();
  const unpublishMutation = useUnpublishProduct();
  const [dialog, setDialog] = useState<LifecycleDialog>(null);
  // Mutation xong ngay khi BE trả lời, nhưng trạng thái trên trang chỉ đổi khi chi tiết tải lại (vài giây):
  // giữ nút ở "Đang xử lý…" tới lúc đó để người dùng không tưởng chưa ăn mà bấm lại.
  const [running, setRunning] = useState<ProductAction["transition"] | null>(null);
  const queryClient = useQueryClient();

  const run = async (action: ProductAction) => {
    if (!product || !action.transition) return;
    const productId = product.productId;
    if (
      action.transition === "reject" ||
      action.transition === "suspend" ||
      action.transition === "resume" ||
      action.transition === "discontinue" ||
      action.transition === "delete"
    ) {
      setDialog(action.transition);
      return;
    }
    setRunning(action.transition);
    try {
      if (action.transition === "publish") await publishMutation.mutateAsync(productId);
      else if (action.transition === "unpublish") await unpublishMutation.mutateAsync(productId);
      else await transitionMutation.mutateAsync({ id: productId, action: action.transition });
      await queryClient.refetchQueries({ queryKey: productKeys.detail(productId) });
    } catch (error: unknown) {
      toast.error(
        "Không thể cập nhật trạng thái",
        error instanceof ApiError
          ? productTransitionErrorMessage(error)
          : "Đã xảy ra lỗi không xác định.",
      );
    } finally {
      setRunning(null);
    }
  };

  return {
    isPending:
      running !== null ||
      transitionMutation.isPending ||
      publishMutation.isPending ||
      unpublishMutation.isPending,
    pendingAction: running,
    run,
    dialog,
    closeDialog: () => setDialog(null),
  };
}
