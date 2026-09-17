import { createMutation, createTransitionMutation } from "@/lib/api/query-factory";

import { createProduct, transitionProduct, transitionSku, updateProduct } from "./api";
import { productKeys, skuKeys } from "./queries";

import type { CreateProductInput } from "./schemas";
import type { Product, Sku } from "./types";
import type { TransitionProductInput, TransitionSkuInput } from "./api";

export const useCreateProduct = createMutation<CreateProductInput, Product>(createProduct, {
  invalidate: [productKeys.all, skuKeys.all],
  showErrorToast: false,
  successMessage: "Tạo sản phẩm thành công",
});

export const useUpdateProduct = createMutation<
  { id: string } & Partial<CreateProductInput>,
  Product
>(updateProduct, {
  invalidate: [productKeys.all, skuKeys.all],
  successMessage: "Cập nhật sản phẩm thành công",
});

export const useTransitionProduct = createTransitionMutation<TransitionProductInput, Product>(
  transitionProduct,
  productKeys,
  [skuKeys.all],
  "Chuyển trạng thái sản phẩm thành công",
);

export const useTransitionSku = createTransitionMutation<TransitionSkuInput, Sku>(
  transitionSku,
  skuKeys,
  [productKeys.all],
  "Chuyển trạng thái SKU thành công",
);
