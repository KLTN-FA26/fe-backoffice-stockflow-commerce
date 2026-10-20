"use client";

import { useEffect, useRef } from "react";

import { UI_LABELS } from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";

import { productToDraftForm, useProduct } from "@/features/product";

import { conflictingFields } from "../edit-conflict";

import type { UseFormReturn } from "react-hook-form";
import type { Product, ProductDraftFormValues } from "@/features/product";

/**
 * Nguồn dữ liệu của form ở chế độ sửa: tải sản phẩm và đổ vào form khi người dùng chưa sửa gì
 * (refetch nền không làm mất nội dung đang nhập).
 *
 * `version` gửi kèm PUT (BE `UpdateProductRequest.version`) là của bản form đang dựa vào (`base`),
 * không phải của bản refetch nền mới nhất — lấy version mới mà không báo sẽ ghi đè mù thay đổi của
 * người khác. BE 409 OPTIMISTIC_LOCK (`Product.requireVersion`) không trả version mới nên
 * `resolveConflict` tải lại sản phẩm, nhận version mới làm `base`, GIỮ nội dung đang nhập và nêu ô
 * người khác vừa đổi — người dùng xem lại rồi bấm Lưu lần nữa (chủ động ghi đè).
 */
export function useProductEditSource(
  productId: string | undefined,
  form: UseFormReturn<ProductDraftFormValues>,
) {
  const query = useProduct(productId);
  // Trang sửa: breadcrumb hiện mã sản phẩm thay cho UUID trên URL (như trang chi tiết).
  useBreadcrumbLabel(productId, query.data?.code);
  const { isDirty } = form.formState;
  const base = useRef<Product | undefined>(undefined);

  useEffect(() => {
    const product = query.data;
    if (!product || isDirty) return;
    base.current = product;
    form.reset(productToDraftForm(product));
  }, [form, isDirty, query.data]);

  const resolveConflict = async (input: ProductDraftFormValues): Promise<string> => {
    const result = await query.refetch();
    // Refetch lỗi vẫn giữ `data` cũ — không lấy version cũ làm `base`
    if (result.isError || !result.data) return UI_LABELS.product.edit.reloadFailed;
    const changed = conflictingFields(base.current, result.data, input);
    base.current = result.data;
    return UI_LABELS.product.edit.stale(changed);
  };

  return { query, baseVersion: () => base.current?.version, resolveConflict };
}
