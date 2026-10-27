/**
 * Tra khách hàng cho ô chọn khách (BE `CustomerController`: `GET /customers` phân trang + `q`,
 * `GET /customers/{id}`; quyền `customer-customers:READ`, chỉ nhân viên back-office).
 *
 * Đặt ở `lib/` để màn bảng giá khách hàng (và màn khác) dùng mà không import feature khách hàng.
 * BE KHÔNG có mã khách hay loại khách (sỉ / lẻ) — chỉ id, họ tên, email, điện thoại, nhóm khách, trạng
 * thái; không tự lọc ACTIVE (BE nhận bảng giá cho khách ở mọi trạng thái), giữ `status` để màn hình hiện.
 * Mã số thuế bị che ở danh sách nên không đọc.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { CUSTOMER_OPTIONS_PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import { bePageSchema } from "@/lib/api/page-schema";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { omittedOrNull } from "@/lib/validation/primitives";

/** BE `CustomerStatus` — để màn hình gắn nhãn; schema nhận cả giá trị mới (không làm hỏng ô chọn). */
export const CUSTOMER_STATUSES = ["PENDING_ACTIVATION", "ACTIVE", "INACTIVE", "BLOCKED"] as const;

/** Phần `CustomerResponse` ô chọn cần; Jackson `non_null` bỏ field trống. */
export const customerOptionSchema = z.object({
  customerId: z.string().min(1),
  fullName: z.string(),
  email: omittedOrNull(z.string()),
  phone: omittedOrNull(z.string()),
  segmentId: omittedOrNull(z.string()),
  status: z.string().min(1),
});
export type CustomerOption = z.infer<typeof customerOptionSchema>;

const customerPageSchema = bePageSchema(customerOptionSchema);

/** Một trang gợi ý; `hasMore` = BE còn trang sau (gõ thêm để thu hẹp hoặc xem trang sau). */
export interface CustomerOptionPage {
  items: CustomerOption[];
  page: number;
  hasMore: boolean;
  totalElements: number;
}

export const customerOptionKeys = {
  all: ["references", "customers"] as const,
  options: (q: string, page: number) => [...customerOptionKeys.all, "options", q, page] as const,
  byId: (customerId: string) => [...customerOptionKeys.all, "by-id", customerId] as const,
};

/**
 * Một trang khách tìm theo `q` (BE: chứa trong họ tên, email hoặc điện thoại; khớp đúng mã số thuế),
 * sắp theo họ tên. `q` rỗng = mọi khách. Không bao giờ tải hết khách để dựng danh sách.
 */
export async function fetchCustomerOptions(
  q: string,
  page = 0,
  signal?: AbortSignal,
): Promise<CustomerOptionPage> {
  const params = new URLSearchParams({
    page: String(Math.max(0, page)),
    size: String(CUSTOMER_OPTIONS_PAGE_SIZE),
    sort: "fullName,asc",
  });
  const term = q.trim();
  if (term) params.set("q", term);
  const { data } = await api.get<unknown>("/customers", { params, signal });
  const parsed = customerPageSchema.parse(data);
  return {
    items: parsed.items,
    page: parsed.page,
    hasMore: parsed.hasNext,
    totalElements: parsed.totalElements,
  };
}

/** `GET /customers/{id}` — tên của khách đang chọn (vd mở trang với `?customerId=`). */
export async function fetchCustomerRef(
  customerId: string,
  signal?: AbortSignal,
): Promise<CustomerOption> {
  const { data } = await api.get<unknown>(`/customers/${encodeURIComponent(customerId)}`, {
    signal,
  });
  return customerOptionSchema.parse(data);
}

/**
 * `q` đã debounce ở component; giữ kết quả cũ khi đang gõ. `canRead` = `customer-customers:READ`
 * (UI-only — BE re-check) — tách khỏi quyền bảng giá.
 */
export function useCustomerOptions(q: string, canRead: boolean, page = 0) {
  const term = q.trim();
  return useQuery({
    queryKey: customerOptionKeys.options(term, page),
    queryFn: ({ signal }) => fetchCustomerOptions(term, page, signal),
    enabled: canRead,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}

export function useCustomerRef(customerId: string | null | undefined, canRead: boolean) {
  return useQuery({
    queryKey: customerOptionKeys.byId(customerId ?? ""),
    queryFn: ({ signal }) => fetchCustomerRef(customerId ?? "", signal),
    enabled: Boolean(customerId) && canRead,
    ...QUERY_TIMES.detail,
  });
}
