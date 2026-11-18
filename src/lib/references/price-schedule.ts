/**
 * Giá riêng của khách cho một SKU — BE `GET /catalog/customer-prices/{customerId}/{sku}`
 * (`catalog-customer-prices:READ`). Không còn giá nhóm / giá gốc / route `/schedule` (kltn-docs 13 BR-04,
 * open-questions D14): giá riêng của khách là nguồn giá duy nhất; chưa có thì Sales tự nhập bậc giá
 * (13 §4.2 bước 5). `measure` CARTON: bậc tính theo SỐ THÙNG, đơn giá theo cái (13 BR-05); UNIT: giá cũ
 * trên biến thể kho, bậc theo số cái — chỉ còn đọc / xoá.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { SKU_CODE_PATTERN } from "@/lib/validation/sku";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

const tierSchema = z.object({ minQuantity: z.number().int(), unitPrice: beDecimal });
const customerOwnPriceSchema = z.object({
  sku: z.string(),
  measure: z.enum(["CARTON", "UNIT"]),
  moq: z.number().int(),
  tiers: z.array(tierSchema),
});

export type CustomerOwnPrice = z.infer<typeof customerOwnPriceSchema>;

/** `null` = khách chưa có giá riêng cho SKU này (404 CUSTOMER_PRICE_NOT_FOUND). */
export function useCustomerOwnPrice(
  customerId: string | undefined,
  sku: string | undefined,
  enabled = true,
) {
  const normalized = sku?.trim().toUpperCase() ?? "";
  return useQuery({
    queryKey: ["references", "customer-own-price", customerId ?? "", normalized],
    queryFn: async ({ signal }) => {
      try {
        const { data } = await api.get<unknown>(
          `/catalog/customer-prices/${encodeURIComponent(customerId ?? "")}/${encodeURIComponent(normalized)}`,
          { signal },
        );
        return customerOwnPriceSchema.parse(data);
      } catch (error) {
        if (error instanceof ApiError && error.code === "CUSTOMER_PRICE_NOT_FOUND") return null;
        throw error;
      }
    },
    enabled: enabled && !!customerId && SKU_CODE_PATTERN.test(normalized),
    ...QUERY_TIMES.master,
  });
}
