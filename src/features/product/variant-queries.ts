import { useQuery } from "@tanstack/react-query";

import { createMutation } from "@/lib/api/query-factory";

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

import type { VariantTransition } from "./variant-api";
import type {
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
  logistics: (productId: string, variantId: string) =>
    ["variants", productId, variantId, "logistics"] as const,
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

export function useSkuLogistics(productId: string, variantId: string | undefined) {
  return useQuery({
    queryKey: variantKeys.logistics(productId, variantId ?? ""),
    queryFn: ({ signal }) => getSkuLogistics(productId, variantId ?? "", signal),
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

const all = [variantKeys.all];

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
