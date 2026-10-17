import { useQuery } from "@tanstack/react-query";

import { createMutation } from "@/lib/api/query-factory";

import { getInventoryControl, saveInventoryControl } from "./inventory-control-api";
import {
  generateVariants,
  getProductAttributes,
  replaceProductAxes,
  replaceProductDescriptives,
} from "./axes-api";
import {
  addVariant,
  deleteVariantMedia,
  getSkuLogistics,
  listVariantMedia,
  listVariants,
  makePrimaryMedia,
  mediaViewUrl,
  publishVariantMedia,
  saveSkuLogistics,
  transitionVariant,
  updateVariant,
  uploadVariantMedia,
  withdrawVariantMedia,
} from "./variant-api";
import { PRODUCT_HISTORY_ROOT } from "./queries";

import type { AxisInput, DescriptiveEntry, ProductAttributes } from "./axes-schemas";
import type { InventoryControl, InventoryControlFormValues } from "./inventory-control-schemas";
import type { VariantTransition } from "./variant-api";
import type {
  GeneratedVariants,
  LogisticsFormValues,
  SkuLogistics,
  Variant,
  VariantInput,
  VariantMedia,
} from "./variant-schemas";

/** Khoá theo sản phẩm: mọi thay đổi biến thể / ảnh / logistics chỉ làm mới đúng sản phẩm đó. */
export const variantKeys = {
  all: ["variants"] as const,
  list: (productId: string) => ["variants", productId, "list"] as const,
  axes: (productId: string) => ["variants", productId, "axes"] as const,
  logistics: (productId: string, variantId: string) =>
    ["variants", productId, variantId, "logistics"] as const,
  media: (productId: string, variantId: string) =>
    ["variants", productId, variantId, "media"] as const,
  inventoryControl: (productId: string, variantId: string) =>
    ["variants", productId, variantId, "inventory-control"] as const,
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

export function useSkuLogistics(productId: string, variantId: string | undefined) {
  return useQuery({
    queryKey: variantKeys.logistics(productId, variantId ?? ""),
    queryFn: ({ signal }) => getSkuLogistics(productId, variantId ?? "", signal),
    enabled: Boolean(variantId),
  });
}

export function useInventoryControl(productId: string, variantId: string | undefined) {
  return useQuery({
    queryKey: variantKeys.inventoryControl(productId, variantId ?? ""),
    queryFn: ({ signal }) => getInventoryControl(productId, variantId ?? "", signal),
    enabled: Boolean(variantId),
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

/** Mọi thay đổi biến thể / trục / ảnh / logistics đều ghi vào lịch sử thay đổi của sản phẩm. */
const all = [variantKeys.all, PRODUCT_HISTORY_ROOT];

export const useAddVariant = createMutation<{ productId: string } & VariantInput, Variant>(
  addVariant,
  { invalidate: all, showErrorToast: false, successMessage: "Đã thêm biến thể" },
);

export const useUpdateVariant = createMutation<
  { productId: string; variantId: string; position: number } & VariantInput,
  Variant
>(updateVariant, {
  invalidate: all,
  showErrorToast: false,
  successMessage: "Đã cập nhật biến thể",
});

export const useTransitionVariant = createMutation<
  { productId: string; variantId: string; action: VariantTransition },
  Variant
>(transitionVariant, {
  invalidate: all,
  showErrorToast: false,
  successMessage: "Đã đổi trạng thái biến thể",
});

export const useSaveSkuLogistics = createMutation<
  { productId: string; variantId: string; version: number; values: LogisticsFormValues },
  SkuLogistics
>(saveSkuLogistics, {
  invalidate: all,
  showErrorToast: false,
  successMessage: "Đã lưu thông tin logistics",
});

export const useUploadVariantMedia = createMutation<
  { productId: string; variantId: string; file: File },
  VariantMedia
>(uploadVariantMedia, { invalidate: all, showErrorToast: false, successMessage: "Đã tải ảnh lên" });

export const useMakePrimaryMedia = createMutation<
  { productId: string; variantId: string; media: VariantMedia },
  VariantMedia
>(makePrimaryMedia, { invalidate: all, showErrorToast: false, successMessage: "Đã đặt ảnh bìa" });

export const usePublishVariantMedia = createMutation<
  { productId: string; variantId: string; mediaIds: string[] },
  VariantMedia[]
>(publishVariantMedia, {
  invalidate: all,
  showErrorToast: false,
  successMessage: "Đã xuất bản ảnh",
});

export const useWithdrawVariantMedia = createMutation<
  { productId: string; variantId: string; mediaId: string },
  VariantMedia
>(withdrawVariantMedia, {
  invalidate: all,
  showErrorToast: false,
  successMessage: "Đã gỡ ảnh khỏi cửa hàng",
});

export const useDeleteVariantMedia = createMutation<
  { productId: string; variantId: string; mediaId: string },
  void
>(deleteVariantMedia, { invalidate: all, showErrorToast: false, successMessage: "Đã xoá ảnh" });

export const useReplaceProductAxes = createMutation<
  { productId: string; axes: AxisInput[] },
  ProductAttributes
>(replaceProductAxes, {
  invalidate: all,
  showErrorToast: false,
  successMessage: "Đã lưu trục biến thể",
});

export const useReplaceProductDescriptives = createMutation<
  { productId: string; attributes: DescriptiveEntry[] },
  ProductAttributes
>(replaceProductDescriptives, {
  invalidate: all,
  showErrorToast: false,
  successMessage: "Đã lưu thuộc tính mô tả",
});

export const useGenerateVariants = createMutation<
  { productId: string; optionValueIds?: Record<string, string[]> },
  GeneratedVariants
>(generateVariants, { invalidate: all, showErrorToast: false });

export const useSaveInventoryControl = createMutation<
  { productId: string; variantId: string; version: number; values: InventoryControlFormValues },
  InventoryControl
>(saveInventoryControl, {
  invalidate: all,
  showErrorToast: false,
  successMessage: "Đã lưu chính sách tồn kho",
});
