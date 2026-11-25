"use client";

import { useMemo } from "react";

import { STANDARD_PRICE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { useCustomerPrice, useStandardPriceSuggestion } from "@/features/quote/queries";

import type { QuotePriceSource } from "@/constants";
import type { CustomerSku, QuoteTier } from "@/features/quote/types";

export interface LinePriceSuggestion {
  tiers: QuoteTier[];
  source: QuotePriceSource;
}

/**
 * Giá gợi ý của một dòng — đúng thứ tự BE lấy khi dòng bỏ trống bậc giá (`QuoteService`, 13 BR-04 / BR-05 sửa ngày
 * 2026-11-26): giá riêng của khách cho SKU, không có thì giá chuẩn của quy cách SKU được làm từ đó (`sourceSku` của SKU
 * riêng). Giá chuẩn chỉ hỏi khi đã biết khách không có giá riêng và người dùng được xem giá chuẩn
 * (`catalog-standard-prices:READ`, UI-only); không xem được thì coi như không có — BE vẫn tự lấy khi lưu.
 */
export function useLinePriceSuggestion(
  customerId: string,
  sku: string | undefined,
  skus: readonly CustomerSku[],
) {
  const canReadStandard = useCan(STANDARD_PRICE_PERMISSIONS.read);
  const own = useCustomerPrice(customerId, sku);
  const code = sku?.trim().toUpperCase() ?? "";
  const sourceSku = skus.find((option) => option.sku === code)?.sourceSku ?? null;
  const ownMissing = own.isSuccess && own.data === null;
  const standard = useStandardPriceSuggestion(sourceSku, canReadStandard && ownMissing);

  const ownData = own.data;
  const standardData = standard.data;
  // Cùng tham chiếu khi dữ liệu không đổi: dòng báo giá dùng nó làm dependency của effect (kiểm lại ô bậc giá)
  const suggestion = useMemo<LinePriceSuggestion | null>(
    () =>
      ownData
        ? { tiers: ownData.tiers, source: "CUSTOMER_PRICE" }
        : ownMissing && standardData
          ? { tiers: standardData.tiers, source: "STANDARD_PRICE" }
          : null,
    [ownData, ownMissing, standardData],
  );
  return {
    suggestion,
    loading: own.isFetching || standard.isFetching,
    failed: own.isError || standard.isError,
  };
}
