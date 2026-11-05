/**
 * Query + mutation thông tin mua hàng của SKU. Khoá nằm dưới `SHARED_QUERY_ROOTS.skuPurchasing` để
 * `inventory-item` và `supplier` (cùng tăng `version` hồ sơ hàng tồn) invalidate được mà không import
 * chéo feature. Mutation viết tay (query-factory: case nhiều module) vì phải huỷ lần đọc đang chạy
 * trước khi ghi kết quả PUT vào cache — `createMutation` không giữ được thứ tự đó.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { inventoryItemKeys } from "@/lib/references/inventory-item-keys";
import { skuSupplierKeys } from "@/lib/references/sku-suppliers";
import { supplierItemKeys } from "@/lib/references/supplier-items";

import { getSkuPurchasing, saveSkuPurchasing } from "./purchasing-api";
import { isStalePurchasingError } from "./purchasing-errors";
import { PRODUCT_HISTORY_ROOT, productKeys } from "./queries";
import { variantKeys } from "./variant-queries";

import type { QueryKey } from "@tanstack/react-query";
import type { MutationHook } from "@/lib/api/stale-refetch";
import type { SaveSkuPurchasingInput } from "./purchasing-api";
import type { SkuPurchasing } from "./purchasing-schemas";

export const skuPurchasingKeys = {
  all: [SHARED_QUERY_ROOTS.skuPurchasing] as const,
  detail: (productId: string, variantId: string) =>
    [SHARED_QUERY_ROOTS.skuPurchasing, productId, variantId] as const,
};

/**
 * Một SKU. `canRead` = `product-products:READ` (UI-only — BE re-check `@RequiresPermission`); false
 * hoặc thiếu id thì không gọi API. 200 với mọi field null là "chưa khai báo", không phải lỗi.
 */
export function useSkuPurchasing(
  productId: string | undefined,
  variantId: string | undefined,
  canRead: boolean,
) {
  return useQuery({
    queryKey: skuPurchasingKeys.detail(productId ?? "", variantId ?? ""),
    queryFn: ({ signal }) => getSkuPurchasing(productId ?? "", variantId ?? "", signal),
    enabled: Boolean(productId) && Boolean(variantId) && canRead,
    ...QUERY_TIMES.detail,
  });
}

const detailKey = (input: SaveSkuPurchasingInput) =>
  skuPurchasingKeys.detail(input.productId, input.variantId);

/** Bản trong cache lúc bắt đầu lưu — để biết NCC mặc định có đổi không (không đọc lại sau khi PUT). */
const before = new WeakMap<SaveSkuPurchasingInput, SkuPurchasing | undefined>();

/**
 * Khoá cần làm mới sau khi lưu. Luôn: hồ sơ hàng tồn (`version` vừa tăng) và lịch sử sản phẩm (BE ghi
 * `PURCHASING`). Khi NCC mặc định đổi: cột "ưu tiên" của danh mục hai NCC cũ / mới và danh sách NCC của
 * SKU (BE suy `preferred` từ `defaultSupplierId`). Không rõ bản trước → làm mới mọi danh mục NCC.
 */
function keysAfterSave(
  previous: SkuPurchasing | undefined,
  saved: SkuPurchasing,
  productId: string,
): QueryKey[] {
  const keys: QueryKey[] = [inventoryItemKeys.all, [...PRODUCT_HISTORY_ROOT, productId]];
  if (previous === undefined) return [...keys, supplierItemKeys.all];
  if (previous.defaultSupplierId === saved.defaultSupplierId) return keys;
  const suppliers = [previous.defaultSupplierId, saved.defaultSupplierId].filter(
    (id): id is string => id !== null,
  );
  return [
    ...keys,
    skuSupplierKeys.bySku(saved.sku),
    ...suppliers.flatMap((id) => [supplierItemKeys.lists(id), supplierItemKeys.catalog(id)]),
  ];
}

const useSaveSkuPurchasingBase: MutationHook<SaveSkuPurchasingInput, SkuPurchasing> = (options) => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, ...rest } = options ?? {};
  return useMutation({
    ...rest,
    mutationFn: saveSkuPurchasing,
    onMutate: async (variables, ...args) => {
      // Lần đọc đang chạy (vd refetch nền) không được ghi đè kết quả PUT sắp về
      await queryClient.cancelQueries({ queryKey: detailKey(variables) });
      before.set(variables, queryClient.getQueryData<SkuPurchasing>(detailKey(variables)));
      return onMutate?.(variables, ...args);
    },
    onSuccess: async (saved, variables, ...args) => {
      const key = detailKey(variables);
      // Huỷ lần đọc bắt đầu trong lúc PUT chạy TRƯỚC khi ghi: huỷ sau sẽ trả cache về bản cũ
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<SkuPurchasing>(key, (current) =>
        current !== undefined && current.version > saved.version ? current : saved,
      );
      for (const queryKey of keysAfterSave(before.get(variables), saved, variables.productId)) {
        void queryClient.invalidateQueries({ queryKey });
      }
      before.delete(variables);
      return onSuccess?.(saved, variables, ...args);
    },
  });
};

/**
 * PUT thay toàn bộ thông tin mua hàng. Lỗi giữ nguyên `ApiError` (mã + `fieldErrors`) cho màn hình;
 * lỗi dữ liệu cũ (`isStalePurchasingError`) tải lại thông tin mua hàng, biến thể và sản phẩm trước
 * khi tới `onError` của màn hình. Phân biệt lệch version bằng `isPurchasingVersionConflict`.
 */
export const useSaveSkuPurchasing = withStaleRefetch(
  useSaveSkuPurchasingBase,
  (input: SaveSkuPurchasingInput) => [
    detailKey(input),
    variantKeys.product(input.productId),
    productKeys.detail(input.productId),
  ],
  isStalePurchasingError,
);
