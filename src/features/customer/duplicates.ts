/**
 * Khách có thể trùng khi tạo hồ sơ (KE-HOACH sales-owner BR-S14, tình huống 16): BE `GET /customers/duplicates?taxCode=
 * &phone=&email=&name=` (`customer-customers:READ`) → `[{customerId, fullName, matchedOn[], salesOwnerName}]`. Chỉ cảnh
 * báo: trùng MST BE còn chặn khi tạo (409 CUSTOMER_TAX_CODE_ALREADY_EXISTS). Endpoint chưa có / lỗi → không hiện gì.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { SALES_OWNER_API } from "@/constants/sales-owner";
import { api } from "@/lib/api/client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { customerKeys } from "./queries";
import { normalizeTaxCode } from "./schemas";

export const customerDuplicateSchema = z.object({
  customerId: z.string(),
  fullName: z.string().nullish(),
  matchedOn: z.array(z.string()).default([]),
  salesOwnerName: z.string().nullish(),
});
export type CustomerDuplicate = z.infer<typeof customerDuplicateSchema>;

/** Danh sách (đọc lỏng: BE bọc trang `items` cũng nhận). */
const duplicatesSchema = z.union([
  z.array(customerDuplicateSchema),
  z.object({ items: z.array(customerDuplicateSchema) }).transform((page) => page.items),
]);

export interface DuplicateProbe {
  taxCode: string;
  phone: string;
  email: string;
  name: string;
}

/** Debounce khi gõ (api-conventions §9: tìm kiếm 300 ms). */
const DEBOUNCE_MS = 400;
const NAME_MIN = 3;
const PHONE_DIGITS_MIN = 9;
const TAX_CODE_DIGITS_MIN = 10;

/** Chỉ gửi ô đã đủ để so (tránh gọi BE với "0", "a@"…); rỗng hết → không gọi. */
export function duplicateParams(probe: DuplicateProbe): Record<string, string> {
  const params: Record<string, string> = {};
  const taxCode = normalizeTaxCode(probe.taxCode);
  if (taxCode.replace(/\D/g, "").length >= TAX_CODE_DIGITS_MIN) params.taxCode = taxCode;
  const phone = probe.phone.trim();
  if (phone.replace(/\D/g, "").length >= PHONE_DIGITS_MIN) params.phone = phone;
  const email = probe.email.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) params.email = email;
  const name = probe.name.trim();
  if (name.length >= NAME_MIN) params.name = name;
  return params;
}

export async function findCustomerDuplicates(
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<CustomerDuplicate[]> {
  const { data } = await api.get<unknown>(SALES_OWNER_API.duplicates, { params, signal });
  return duplicatesSchema.parse(data);
}

/** Khách có thể trùng với các ô đang nhập; `[]` khi chưa đủ để so, endpoint chưa có hay lỗi. */
export function useCustomerDuplicates(probe: DuplicateProbe, enabled = true): CustomerDuplicate[] {
  // Debounce chuỗi (không phải object): object mới mỗi lần render sẽ làm hẹn giờ chạy lại mãi.
  const key = useDebouncedValue(JSON.stringify(duplicateParams(probe)), DEBOUNCE_MS);
  const params = z.record(z.string(), z.string()).parse(JSON.parse(key));
  const query = useQuery({
    queryKey: [...customerKeys.all, "duplicates", params] as const,
    queryFn: ({ signal }) => findCustomerDuplicates(params, signal),
    enabled: enabled && Object.keys(params).length > 0,
    retry: false,
    staleTime: 30_000,
  });
  return query.data ?? [];
}
