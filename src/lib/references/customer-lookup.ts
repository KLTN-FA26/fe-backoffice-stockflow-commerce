/**
 * Tra cứu khách hàng cho module khác (báo giá, mẫu, LSX) — không import `features/customer`
 * (feature-architecture). BE `GET /customers` / `GET /customers/{id}` (d215f6e) chỉ cho
 * SALES_STAFF / ECOMMERCE_ADMIN; vai trò khác → hook tắt, UI hiện mã thay cho tên.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { COMBOBOX_MAX_ROWS, CUSTOMER_API_STATUSES } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

const customerRefSchema = z.object({
  customerId: z.string(),
  fullName: z.string(),
  email: z.string(),
  status: z.enum(CUSTOMER_API_STATUSES),
  taxCode: z.string().nullish(),
});
const customerRefPageSchema = z.object({
  items: z.array(customerRefSchema),
  // BE `PageResponse.totalElements` — để ô chọn báo "Còn N khách" khi chỉ hiện trang đầu
  totalElements: z.number().int().min(0).optional(),
});

export type CustomerRef = z.infer<typeof customerRefSchema>;

export const customerRefKeys = {
  all: ["references", "customers"] as const,
  one: (id: string) => [...customerRefKeys.all, "one", id] as const,
  search: (q: string, activeOnly: boolean) =>
    [...customerRefKeys.all, "search", activeOnly ? "active" : "any", q] as const,
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

/** Một lần tìm khách: tối đa `COMBOBOX_MAX_ROWS` khách + tổng số khớp (để báo "Còn N khách — gõ thêm"). */
export interface CustomerSearchResult {
  items: CustomerRef[];
  /** Tổng số khách khớp (BE `totalElements`); không có thì bằng số khách đang hiện. */
  total: number;
}

/**
 * Ô chọn khách, BE tìm theo `q` (tên, email, SĐT; khớp đúng MST), sắp theo tên. `activeOnly` (mặc định) chỉ lấy khách
 * ACTIVE — dùng khi chọn khách cho việc mới (BE CUSTOMER_NOT_ACTIVE); bộ lọc danh sách (đơn, yêu cầu báo giá) truyền
 * `false` để lọc được cả khách đã khoá / chưa kích hoạt.
 */
export function useCustomerSearch(q: string, { enabled = true, activeOnly = true } = {}) {
  return useQuery({
    queryKey: customerRefKeys.search(q.trim(), activeOnly),
    queryFn: async ({ signal }): Promise<CustomerSearchResult> => {
      const params = new URLSearchParams({
        page: "0",
        size: String(COMBOBOX_MAX_ROWS),
        sort: "fullName,asc",
      });
      if (activeOnly) params.set("status", "ACTIVE");
      if (q.trim()) params.set("q", q.trim());
      const { data } = await api.get<unknown>("/customers", { params, signal });
      const page = customerRefPageSchema.parse(data);
      return { items: page.items, total: page.totalElements ?? page.items.length };
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
