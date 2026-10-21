/**
 * Bảng giá theo khách cho một phôi — BE (d215f6e) `GET /catalog/customer-prices/{customerId}/{sku}/schedule`
 * (`catalog-customer-prices:READ`; Sales có). Ưu tiên giá khách → nhóm → giá gốc (P7), không có
 * thời hạn (P3). 409 PRICE_NOT_AVAILABLE = chưa có giá → Sales phải nhập bậc giá thoả thuận (P4).
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { SKU_CODE_PATTERN } from "@/lib/validation/sku";

const tierSchema = z.object({ minQuantity: z.number().int(), unitPrice: z.number() });
const priceScheduleSchema = z.object({
  sku: z.string(),
  source: z.enum(["CUSTOMER", "SEGMENT", "BASE"]),
  moq: z.number().int(),
  currency: z.string(),
  tiers: z.array(tierSchema),
});

export type PriceSchedule = z.infer<typeof priceScheduleSchema>;

export const PRICE_SOURCE_LABEL: Readonly<Record<PriceSchedule["source"], string>> = {
  CUSTOMER: "Giá riêng của khách",
  SEGMENT: "Giá nhóm khách",
  BASE: "Giá niêm yết",
};

/** `null` = chưa có giá áp dụng (PRICE_NOT_AVAILABLE). */
export function useCustomerPriceSchedule(
  customerId: string | undefined,
  sku: string | undefined,
  enabled = true,
) {
  const normalized = sku?.trim().toUpperCase() ?? "";
  return useQuery({
    queryKey: ["references", "price-schedule", customerId ?? "", normalized],
    queryFn: async ({ signal }) => {
      try {
        const { data } = await api.get<unknown>(
          `/catalog/customer-prices/${encodeURIComponent(customerId ?? "")}/${encodeURIComponent(normalized)}/schedule`,
          { signal },
        );
        return priceScheduleSchema.parse(data);
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.code === "PRICE_NOT_AVAILABLE" || error.status === 404)
        )
          return null;
        throw error;
      }
    },
    enabled: enabled && !!customerId && SKU_CODE_PATTERN.test(normalized),
    ...QUERY_TIMES.master,
  });
}
