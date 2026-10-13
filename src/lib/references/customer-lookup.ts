/**
 * Tra cứu khách hàng cho module khác (báo giá, mẫu, LSX) — không import `features/customer`
 * (feature-architecture). BE `GET /customers` / `GET /customers/{id}` (d215f6e) chỉ cho
 * SALES_STAFF / ECOMMERCE_ADMIN; vai trò khác → hook tắt, UI hiện mã thay cho tên.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { CUSTOMER_API_STATUSES } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

const customerRefSchema = z.object({
  customerId: z.string(),
  fullName: z.string(),
  email: z.string(),
  status: z.enum(CUSTOMER_API_STATUSES),
  taxCode: z.string().nullish(),
});
const customerRefPageSchema = z.object({ items: z.array(customerRefSchema) });

export type CustomerRef = z.infer<typeof customerRefSchema>;

export const customerRefKeys = {
  all: ["references", "customers"] as const,
  one: (id: string) => [...customerRefKeys.all, "one", id] as const,
  search: (q: string) => [...customerRefKeys.all, "search", q] as const,
};

export async function fetchCustomerRef(id: string, signal?: AbortSignal): Promise<CustomerRef> {
  const { data } = await api.get<unknown>(`/customers/${encodeURIComponent(id)}`, { signal });
  return customerRefSchema.parse(data);
}

/** Tên khách theo id (cache 10 phút). `enabled=false` khi người dùng không có quyền đọc khách. */
export function useCustomerRef(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: customerRefKeys.one(id ?? ""),
    queryFn: ({ signal }) => fetchCustomerRef(id ?? "", signal),
    enabled: enabled && !!id,
    ...QUERY_TIMES.master,
  });
}

/** Ô chọn khách: chỉ khách ACTIVE mới nhận việc mới (BE CUSTOMER_NOT_ACTIVE). */
export function useActiveCustomerSearch(q: string, enabled = true) {
  return useQuery({
    queryKey: customerRefKeys.search(q),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        page: "0",
        size: "20",
        status: "ACTIVE",
        sort: "fullName,asc",
      });
      if (q.trim()) params.set("q", q.trim());
      const { data } = await api.get<unknown>("/customers", { params, signal });
      return customerRefPageSchema.parse(data).items;
    },
    enabled,
    ...QUERY_TIMES.list,
  });
}

const addressRefSchema = z.object({
  addressId: z.string(),
  type: z.enum(["SHIPPING", "BILLING"]),
  recipientName: z.string(),
  phone: z.string(),
  line1: z.string(),
  line2: z.string().nullish(),
  wardName: z.string(),
  provinceName: z.string(),
  defaultAddress: z.boolean(),
});
export type CustomerAddressRef = z.infer<typeof addressRefSchema>;

/** Sổ địa chỉ của khách (VN tỉnh / xã) — `customer-addresses:READ` (Sales, Quản trị TMĐT). */
export function useCustomerAddressOptions(customerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...customerRefKeys.all, "addresses", customerId ?? ""],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<unknown>(
        `/customers/${encodeURIComponent(customerId ?? "")}/addresses`,
        { signal },
      );
      return z.array(addressRefSchema).parse(data);
    },
    enabled: enabled && !!customerId,
    ...QUERY_TIMES.detail,
  });
}

export function formatAddress(address: CustomerAddressRef): string {
  return [
    address.recipientName,
    address.line1,
    address.line2,
    address.wardName,
    address.provinceName,
  ]
    .filter(Boolean)
    .join(", ");
}

const creditTermsSchema = z.object({
  allowPrepaid: z.boolean(),
  allowDeposit: z.boolean(),
  allowCredit: z.boolean(),
  defaultPaymentTerm: z.enum(["PREPAID", "DEPOSIT", "CREDIT"]),
  depositPercent: z.number().nullish(),
});
export type CreditTermsRef = z.infer<typeof creditTermsSchema>;

/**
 * Điều khoản thanh toán đang được phép của khách (`customer-credit-profiles:READ`). R1b: chỉ
 * điều khoản hiện hành được chào / chấp nhận — BE kiểm lại lúc gửi, chấp nhận và chuyển đơn.
 */
export function useCustomerCreditTerms(customerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...customerRefKeys.all, "credit-terms", customerId ?? ""],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<unknown>(
        `/customers/${encodeURIComponent(customerId ?? "")}/credit-profile`,
        { signal },
      );
      return creditTermsSchema.parse(data);
    },
    enabled: enabled && !!customerId,
    ...QUERY_TIMES.detail,
  });
}

export function allowedTermsOf(terms: CreditTermsRef): ("PREPAID" | "DEPOSIT" | "CREDIT")[] {
  return [
    ...(terms.allowPrepaid ? (["PREPAID"] as const) : []),
    ...(terms.allowDeposit ? (["DEPOSIT"] as const) : []),
    ...(terms.allowCredit ? (["CREDIT"] as const) : []),
  ];
}
