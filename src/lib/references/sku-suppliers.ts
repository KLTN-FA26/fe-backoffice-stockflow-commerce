/**
 * Các NCC đang bán một SKU (BE `GET /procurement/skus/{sku}/suppliers`, `SupplierItemController`
 * #117) — NCC mặc định đứng đầu. Quyền như danh mục: `procurement-supplier-items:READ`.
 *
 * Dùng để lấy điều khoản (MOQ, quy cách, giá, lead time) của một SKU khi danh mục NCC dài hơn trang
 * tối đa BE trả (200 dòng) nên SKU không nằm trong `fetchSupplierCatalog`.
 */

import { useQueries, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { omittedOrNull } from "@/lib/validation/primitives";

import { supplierItemKeys } from "./supplier-items";

export const skuSupplierSchema = z.object({
  supplierId: z.string().min(1),
  supplierCode: z.string(),
  supplierName: z.string(),
  supplierStatus: z.string(),
  supplierItemId: z.string().min(1),
  supplierSkuCode: omittedOrNull(z.string()),
  price: z.coerce.number(),
  currency: z.string().min(1),
  moq: z.number().int().min(1),
  packSize: z.number().int().min(1),
  effectiveLeadTimeDays: z.number().int(),
  preferred: z.boolean(),
});

export type SkuSupplierRef = z.infer<typeof skuSupplierSchema>;

export const skuSupplierKeys = {
  bySku: (sku: string) => [...supplierItemKeys.all, "sku-suppliers", sku] as const,
};

export async function fetchSkuSuppliers(
  sku: string,
  signal?: AbortSignal,
): Promise<SkuSupplierRef[]> {
  const { data } = await api.get<unknown>(
    `/procurement/skus/${encodeURIComponent(sku)}/suppliers`,
    { signal },
  );
  return z.array(skuSupplierSchema).parse(data);
}

/**
 * Mọi NCC đang bán một SKU (NCC mặc định đứng đầu). `enabled` gồm quyền `procurement-supplier-items:READ`
 * (UI-only — BE re-check): thiếu quyền thì không gọi API. Cùng khoá `bySku` với `useSupplierTermsForSkus`
 * nên sửa danh mục NCC / NCC mặc định làm mới cả hai.
 */
export function useSkuSuppliers(sku: string, enabled: boolean) {
  return useQuery({
    queryKey: skuSupplierKeys.bySku(sku),
    queryFn: ({ signal }) => fetchSkuSuppliers(sku, signal),
    enabled: enabled && sku !== "",
    ...QUERY_TIMES.master,
  });
}

/**
 * Điều khoản của `supplierId` cho từng SKU trong `skus` (mỗi SKU một request). `bySku` chỉ có SKU mà
 * NCC này đang bán; SKU không có trong kết quả = NCC không còn liệt kê.
 */
export function useSupplierTermsForSkus(
  supplierId: string,
  skus: readonly string[],
  enabled: boolean,
) {
  return useQueries({
    queries: skus.map((sku) => ({
      queryKey: skuSupplierKeys.bySku(sku),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchSkuSuppliers(sku, signal),
      enabled: enabled && supplierId !== "",
      ...QUERY_TIMES.master,
    })),
    combine: (results) => {
      const bySku = new Map<string, SkuSupplierRef>();
      results.forEach((result, i) => {
        const row = result.data?.find((r) => r.supplierId === supplierId);
        const sku = skus[i];
        if (row && sku !== undefined) bySku.set(sku, row);
      });
      return {
        bySku,
        isPending: results.some((r) => r.isPending && r.fetchStatus !== "idle"),
        isError: results.some((r) => r.isError && !r.data),
        error: results.find((r) => r.isError && !r.data)?.error ?? null,
        refetch: () => results.forEach((r) => void r.refetch()),
      };
    },
  });
}
