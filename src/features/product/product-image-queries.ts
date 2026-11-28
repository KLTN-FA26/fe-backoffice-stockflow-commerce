import { useQuery } from "@tanstack/react-query";

import { createMutation } from "@/lib/api/query-factory";

import {
  deleteProductImage,
  describeProductImage,
  getProductImage,
  uploadProductImage,
} from "./product-image-api";
import { PRODUCT_HISTORY_ROOT } from "./queries";

export const productImageKeys = {
  all: ["products", "image"] as const,
  detail: (productId: string) => ["products", "image", productId] as const,
};

/** Ảnh riêng của sản phẩm (ADR-0012); `null` khi chưa có. */
export function useProductImage(productId: string, enabled = true) {
  return useQuery({
    queryKey: productImageKeys.detail(productId),
    queryFn: ({ signal }) => getProductImage(productId, signal),
    enabled,
  });
}

/** Đổi ảnh ghi vào lịch sử thay đổi của sản phẩm (BE `UPDATED`, trường `image` / `imageAltText`). */
const invalidate = [productImageKeys.all, PRODUCT_HISTORY_ROOT];

export const useUploadProductImage = createMutation(uploadProductImage, {
  invalidate,
  showErrorToast: false,
  successMessage: "Đã lưu ảnh sản phẩm",
});

export const useDescribeProductImage = createMutation(describeProductImage, {
  invalidate,
  showErrorToast: false,
  successMessage: "Đã lưu chữ thay thế",
});

export const useDeleteProductImage = createMutation(deleteProductImage, {
  invalidate,
  showErrorToast: false,
  successMessage: "Đã gỡ ảnh sản phẩm",
});
