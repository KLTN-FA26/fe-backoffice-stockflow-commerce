import { createMutation, createTransitionMutation } from "@/lib/api/query-factory";

import {
  createProduct,
  publishProduct,
  transitionProduct,
  transitionSku,
  unpublishProduct,
  updateProduct,
} from "./api";
import { productKeys, skuKeys } from "./queries";

import type { CreateProductInput, UpdateProductInput } from "./schemas";
import type { Product, Sku } from "./types";
import type { TransitionProductInput, TransitionSkuInput } from "./api";

export const useCreateProduct = createMutation<CreateProductInput, Product>(createProduct, {
  invalidate: [productKeys.all, skuKeys.all],
  showErrorToast: false,
  successMessage: "Tạo sản phẩm thành công",
});

export const useUpdateProduct = createMutation<{ id: string } & UpdateProductInput, Product>(
  updateProduct,
  {
    invalidate: [productKeys.all, skuKeys.all],
    showErrorToast: false,
    successMessage: "Cập nhật sản phẩm thành công",
  },
);

export const useTransitionProduct = createMutation<TransitionProductInput, Product>(
  transitionProduct,
  {
    invalidate: [productKeys.all, skuKeys.all],
    showErrorToast: false,
    successMessage: "Chuyển trạng thái sản phẩm thành công",
  },
);

export const usePublishProduct = createMutation<string, void>(publishProduct, {
  invalidate: [productKeys.all],
  showErrorToast: false,
  successMessage: "Xuất bản sản phẩm thành công",
});

export const useUnpublishProduct = createMutation<string, void>(unpublishProduct, {
  invalidate: [productKeys.all],
  showErrorToast: false,
  successMessage: "Gỡ xuất bản sản phẩm thành công",
});

export const useTransitionSku = createTransitionMutation<TransitionSkuInput, Sku>(
  transitionSku,
  skuKeys,
  [productKeys.all],
  "Chuyển trạng thái SKU thành công",
);
