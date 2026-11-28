"use client";

import { useQueries } from "@tanstack/react-query";

import { STANDARD_PRICE_PERMISSIONS } from "@/constants";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { useCan } from "@/lib/auth/components/Can";
import { getCustomerPrice, getStandardPriceSuggestion } from "@/features/quote/api";
import { customerSkuKeys } from "@/features/quote/queries";

import type { PriceReferences } from "@/features/quote/selectors";
import type { CustomerSku } from "@/features/quote/types";

const normalize = (sku: string | null | undefined) => sku?.trim().toUpperCase() ?? "";

/**
 * Giá tham chiếu của từng dòng trên form báo giá (14 BR-10, 13 BR-04 / BR-05) — cùng khoá query với từng dòng
 * (`useLinePriceSuggestion`), nên chỉ đọc lại cache, không gọi thêm: giá riêng của khách cho SKU; khách không có giá riêng
 * thì giá chuẩn của quy cách SKU được làm từ đó (chỉ khi người dùng được xem giá chuẩn — `catalog-standard-prices:READ`,
 * UI-only). `undefined` trong kết quả = chưa biết (đang tải, lỗi, không được xem).
 */
export function usePriceReferences(
  customerId: string,
  lineSkus: readonly (string | null | undefined)[],
  customerSkus: readonly CustomerSku[],
): PriceReferences[] {
  const canReadStandard = useCan(STANDARD_PRICE_PERMISSIONS.read);
  const codes = lineSkus.map(normalize);
  const own = useQueries({
    queries: codes.map((sku) => ({
      queryKey: customerSkuKeys.price(customerId, sku),
      queryFn: ({ signal }: { signal: AbortSignal }) => getCustomerPrice(customerId, sku, signal),
      enabled: !!customerId && !!sku,
      ...QUERY_TIMES.master,
    })),
  });
  const bySku = new Map(customerSkus.map((sku) => [normalize(sku.sku), sku]));
  const sourceOf = (sku: string) => normalize(bySku.get(sku)?.sourceSku);
  const standard = useQueries({
    queries: codes.map((sku, index) => {
      const variantSku = sourceOf(sku);
      return {
        queryKey: customerSkuKeys.standardPrice(variantSku),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          getStandardPriceSuggestion(variantSku, signal),
        enabled:
          canReadStandard && !!variantSku && own[index]?.isSuccess === true && !own[index]?.data,
        ...QUERY_TIMES.master,
      };
    }),
  });

  return codes.map((sku, index) => {
    const ownQuery = own[index];
    if (!sku || !ownQuery?.isSuccess) return { own: undefined, standard: undefined };
    if (ownQuery.data) return { own: ownQuery.data.tiers, standard: undefined };
    // SKU riêng không ghi quy cách gốc → BE cũng không có giá chuẩn để so.
    if (!sourceOf(sku)) return { own: null, standard: null };
    const standardQuery = standard[index];
    if (!canReadStandard || !standardQuery?.isSuccess) return { own: null, standard: undefined };
    return { own: null, standard: standardQuery.data?.tiers ?? null };
  });
}
