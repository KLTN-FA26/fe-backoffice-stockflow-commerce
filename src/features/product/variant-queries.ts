import { useQuery } from "@tanstack/react-query";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { inventoryItemKeys } from "@/lib/references/inventory-item-keys";

import { isStaleAttributeError } from "./attribute-errors";
import { attributeKeys } from "./attribute-queries";
import {
  generateVariants,
  getProductAttributes,
  replaceProductAxes,
  replaceProductDescriptives,
} from "./axes-api";
import {
  addVariant,
  deleteVariantMedia,
  listVariantMedia,
  listVariants,
  makePrimaryMedia,
  mediaViewUrl,
  publishVariantMedia,
  transitionVariant,
  updateVariant,
  uploadVariantMedia,
  withdrawVariantMedia,
} from "./variant-api";
import { isStaleVariantError } from "./variant-errors";
import { PRODUCT_HISTORY_ROOT } from "./queries";

import type { AxisInput, DescriptiveEntry, ProductAttributes } from "./axes-schemas";
import type { GeneratedVariants, VariantMedia } from "./variant-schemas";

/** Khoá theo sản phẩm: mọi thay đổi biến thể / trục / ảnh chỉ làm mới đúng sản phẩm đó. */
export const variantKeys = {
  all: ["variants"] as const,
  /** Mọi thứ của một sản phẩm: danh sách, trục, ảnh. */
  product: (productId: string) => ["variants", productId] as const,
  list: (productId: string) => ["variants", productId, "list"] as const,
  axes: (productId: string) => ["variants", productId, "axes"] as const,
  media: (productId: string, variantId: string) =>
    ["variants", productId, variantId, "media"] as const,
  mediaUrl: (productId: string, variantId: string, mediaId: string, edge: number) =>
    ["variants", productId, variantId, "media", mediaId, edge] as const,
};

export function useVariants(productId: string | undefined) {
  return useQuery({
    queryKey: variantKeys.list(productId ?? ""),
    queryFn: ({ signal }) => listVariants(productId ?? "", signal),
    enabled: Boolean(productId),
  });
}

/** Trục + thuộc tính mô tả của sản phẩm (BE `GET /products/{id}/attributes`). */
export function useProductAttributes(productId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: variantKeys.axes(productId ?? ""),
    queryFn: ({ signal }) => getProductAttributes(productId ?? "", signal),
    enabled: Boolean(productId) && enabled,
  });
}

/** Trục của sản phẩm — quyết định form thêm biến thể (chọn tuỳ chọn hay nhập SKU tay). */
export function useProductAxes(productId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: variantKeys.axes(productId ?? ""),
    queryFn: ({ signal }) => getProductAttributes(productId ?? "", signal),
    select: (attributes: ProductAttributes) => attributes.axes,
    enabled: Boolean(productId) && enabled,
  });
}

export function useVariantMedia(productId: string, variantId: string | undefined) {
  return useQuery({
    queryKey: variantKeys.media(productId, variantId ?? ""),
    queryFn: ({ signal }) => listVariantMedia(productId, variantId ?? "", signal),
    enabled: Boolean(variantId),
  });
}

/** Link ảnh có hạn ngắn (vài phút) → làm mới trước khi hết hạn, không cache lâu. */
const MEDIA_URL_STALE_MS = 60_000;

export function useMediaViewUrl(
  productId: string,
  variantId: string,
  media: VariantMedia,
  edge: number,
) {
  return useQuery({
    queryKey: variantKeys.mediaUrl(productId, variantId, media.mediaId, edge),
    queryFn: ({ signal }) => mediaViewUrl(productId, variantId, media, edge, signal),
    staleTime: MEDIA_URL_STALE_MS,
    retry: false,
  });
}

/** Mọi thay đổi biến thể / trục / ảnh đều ghi vào lịch sử thay đổi của sản phẩm. */
const all = [variantKeys.all, PRODUCT_HISTORY_ROOT];
/**
 * Thêm / sửa biến thể có thể ĐỔI SKU của biến thể nháp (BE `ProductVariantService.update`, biến thể mặc
 * định khi thêm): hồ sơ hàng tồn đi theo SKU mới và tăng `version` (BE `inventory.guard_item_sku_rename`),
 * nên thông tin mua hàng (khoá theo biến thể, chứa SKU + version) và hồ sơ hàng tồn phải tải lại.
 */
const withSkuRename = [...all, [SHARED_QUERY_ROOTS.skuPurchasing], inventoryItemKeys.all];

/**
 * Mutation biến thể / ảnh: thành công làm mới biến thể + lịch sử; lỗi dữ liệu cũ
 * (`isStaleVariantError`) tải lại biến thể / ảnh của sản phẩm trước khi màn hình báo "Đã tải lại".
 */
const variantMutation = <TInput extends { productId: string }, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  successMessage: string,
  invalidate: readonly (readonly unknown[])[] = all,
) =>
  withStaleRefetch(
    createMutation<TInput, TResult>(fn, { invalidate, showErrorToast: false, successMessage }),
    (input: TInput) => [variantKeys.product(input.productId)],
    isStaleVariantError,
  );

export const useAddVariant = variantMutation(addVariant, "Đã thêm biến thể", withSkuRename);
export const useUpdateVariant = variantMutation(
  updateVariant,
  "Đã cập nhật biến thể",
  withSkuRename,
);
export const useTransitionVariant = variantMutation(
  transitionVariant,
  "Đã đổi trạng thái biến thể",
);
export const useUploadVariantMedia = variantMutation(uploadVariantMedia, "Đã tải ảnh lên");
export const useMakePrimaryMedia = variantMutation(makePrimaryMedia, "Đã đặt ảnh bìa");
export const usePublishVariantMedia = variantMutation(publishVariantMedia, "Đã xuất bản ảnh");
export const useWithdrawVariantMedia = variantMutation(
  withdrawVariantMedia,
  "Đã gỡ ảnh khỏi cửa hàng",
);
export const useDeleteVariantMedia = variantMutation(deleteVariantMedia, "Đã xoá ảnh");

/**
 * Trục / mô tả / sinh ma trận tham chiếu từ điển: lỗi dữ liệu cũ (`isStaleAttributeError`) → tải lại
 * thuộc tính + biến thể của sản phẩm và từ điển, để câu "Đã tải lại" của `attributeErrorMessage` là thật.
 */
const staleAxes = ({ productId }: { productId: string }) => [
  variantKeys.product(productId),
  attributeKeys.all,
];

export const useReplaceProductAxes = withStaleRefetch(
  createMutation<{ productId: string; axes: AxisInput[] }, ProductAttributes>(replaceProductAxes, {
    invalidate: all,
    showErrorToast: false,
    successMessage: "Đã lưu trục biến thể",
  }),
  staleAxes,
  isStaleAttributeError,
);

export const useReplaceProductDescriptives = withStaleRefetch(
  createMutation<{ productId: string; attributes: DescriptiveEntry[] }, ProductAttributes>(
    replaceProductDescriptives,
    { invalidate: all, showErrorToast: false, successMessage: "Đã lưu thuộc tính mô tả" },
  ),
  staleAxes,
  isStaleAttributeError,
);

export const useGenerateVariants = withStaleRefetch(
  createMutation<
    { productId: string; optionValueIds?: Record<string, string[]> },
    GeneratedVariants
  >(generateVariants, { invalidate: all, showErrorToast: false }),
  staleAxes,
  isStaleAttributeError,
);
