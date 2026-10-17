import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/error";

import { createMutation } from "@/lib/api/query-factory";

import { getListing, getSkuPrice, saveListing, saveSkuPrice } from "./listing-api";
import { productKeys } from "./queries";

import type { Listing, ListingFormValues } from "./listing-schemas";

/**
 * Listing và giá chung một `revision`, và revision đó CHÍNH LÀ `version` của sản phẩm (BE
 * `CatalogCommerceService.get`): sửa listing / giá làm tăng version sản phẩm, nên cũng làm mới sản phẩm;
 * ngược lại mọi thao tác sản phẩm làm mới listing + giá (xem `mutations.ts`).
 */
export const listingKeys = {
  all: ["listing"] as const,
  listing: (productId: string) => ["listing", productId, "ecommerce"] as const,
  price: (productId: string, sku: string) => ["listing", productId, "price", sku] as const,
};

export function useListing(productId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: listingKeys.listing(productId ?? ""),
    queryFn: ({ signal }) => getListing(productId ?? "", signal),
    enabled: Boolean(productId) && enabled,
  });
}

export function useSkuPrice(productId: string, sku: string | undefined, enabled = true) {
  return useQuery({
    queryKey: listingKeys.price(productId, sku ?? ""),
    queryFn: ({ signal }) => getSkuPrice(productId, sku ?? "", signal),
    enabled: Boolean(sku) && enabled,
  });
}

export const useSaveListing = createMutation<
  { productId: string; revision: number; values: ListingFormValues },
  Listing
>(saveListing, {
  invalidate: [listingKeys.all, productKeys.all],
  showErrorToast: false,
  successMessage: "Đã lưu thông tin cửa hàng",
});

export const useSaveSkuPrice = createMutation<
  { productId: string; sku: string; revision: number; price: number },
  Listing
>(saveSkuPrice, {
  invalidate: [listingKeys.all, productKeys.all],
  showErrorToast: false,
  successMessage: "Đã lưu giá bán",
});

/**
 * 409 CONFLICT của listing / giá: revision đã cũ (hoặc sản phẩm đã ngừng) → lấy lại listing, giá và sản
 * phẩm để lần lưu sau mang revision đúng. Trả hàm nhận lỗi vừa nhận được.
 */
export function useRefreshOnConflict() {
  const client = useQueryClient();
  return (error: unknown) => {
    if (error instanceof ApiError && error.code === "CONFLICT") {
      void client.invalidateQueries({ queryKey: listingKeys.all });
      void client.invalidateQueries({ queryKey: productKeys.all });
    }
  };
}
