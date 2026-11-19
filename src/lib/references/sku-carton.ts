/**
 * Số cái chuẩn / thùng của một SKU riêng của khách (kltn-docs 13 §3: màn giá nội bộ hiện số cái / thùng; 01 BR-03).
 * Tra SKU riêng của khách (`GET /customer-skus`, `product-variants:READ`) để có sản phẩm + biến thể, rồi đơn vị
 * tính của biến thể (`GET …/uom-conversions`, `product-products:READ`) và chọn thùng theo luật BE `cartonOf`.
 * `null` = SKU chưa có thùng, hoặc không phải SKU riêng của khách này.
 */

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { beUomConversionSchema, cartonOf } from "@/lib/domain/carton";

import { useCustomerSkus } from "./customer-skus";

/** BE giới hạn trang 200; một SKU chỉ có vài đơn vị. */
const UNIT_PAGE_SIZE = 200;

async function fetchUnitsPerCarton(
  productId: string,
  variantId: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const { data } = await api.get<unknown>(
    `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/uom-conversions`,
    { params: { page: 0, size: UNIT_PAGE_SIZE }, signal },
  );
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) throw new Error("UoM conversion page response is malformed");
  const lookup = cartonOf(items.map((row) => beUomConversionSchema.parse(row)));
  return lookup.kind === "carton" ? lookup.carton.factor : null;
}

export function useSkuUnitsPerCarton(customerId: string, sku: string, enabled: boolean) {
  const skus = useCustomerSkus(customerId, enabled);
  const owned = skus.data?.find((s) => s.sku.toUpperCase() === sku.toUpperCase());
  const units = useQuery({
    queryKey: ["references", "sku-carton", owned?.variantId ?? ""] as const,
    queryFn: ({ signal }) =>
      fetchUnitsPerCarton(owned?.productId ?? "", owned?.variantId ?? "", signal),
    enabled: enabled && owned !== undefined,
    ...QUERY_TIMES.detail,
  });
  return {
    unitsPerCarton: owned === undefined ? null : (units.data ?? null),
    isPending: enabled && (skus.isPending || (owned !== undefined && units.isPending)),
  };
}
