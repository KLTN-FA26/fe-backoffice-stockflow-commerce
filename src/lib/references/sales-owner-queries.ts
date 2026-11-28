/**
 * Đọc người phụ trách của khách (BE `GET /customers/{id}/sales-owner`, `customer-sales-owners:READ`) cho các màn của
 * module khác: báo giá, hợp đồng, chat, hộp yêu cầu báo giá. Không có quyền đọc, BE chưa có endpoint (404 / 400 / 403)
 * hay lỗi mạng → "không biết" → không chặn nút nào (BE vẫn kiểm, lỗi được đổi thành câu rõ ràng).
 *
 * Key nằm dưới root `customers` (`QUERY_ROOTS.customers`): đổi người phụ trách ở trang khách (invalidate `customerKeys.all`)
 * làm các màn này tải lại theo. Key riêng `sales-owner-access`, không dùng chung key với thẻ "Sale phụ trách" của trang
 * khách, vì mỗi nơi parse một kiểu.
 */

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { SALES_OWNER_API, SALES_OWNER_PERMISSIONS } from "@/constants/sales-owner";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { useAuthStore } from "@/lib/auth/auth-store";
import { usePermissionChecker } from "@/lib/auth/components/Can";

import { salesOwnerAccessOf, salesOwnerSchema } from "./sales-owner-access";

import type { SalesOwner, SalesOwnerAccess } from "./sales-owner-access";

export const salesOwnerAccessKeys = {
  all: [...QUERY_ROOTS.customers, "sales-owner-access"] as const,
  one: (customerId: string) => [...salesOwnerAccessKeys.all, customerId] as const,
};

export async function fetchSalesOwner(
  customerId: string,
  signal?: AbortSignal,
): Promise<SalesOwner> {
  const { data } = await api.get<unknown>(SALES_OWNER_API.owner(customerId), { signal });
  return salesOwnerSchema.parse(data);
}

const ownerQuery = (customerId: string, enabled: boolean) => ({
  queryKey: salesOwnerAccessKeys.one(customerId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchSalesOwner(customerId, signal),
  enabled: enabled && !!customerId,
  // Không thử lại: 404 / 400 / 403 nghĩa là chưa có tính năng — ẩn đi, không gọi lại liên tục.
  retry: false,
  ...QUERY_TIMES.detail,
});

/** Người phụ trách của một khách; `data` vắng khi không đọc được. */
export function useSalesOwner(customerId: string | null | undefined) {
  const can = usePermissionChecker();
  return useQuery(ownerQuery(customerId ?? "", can(SALES_OWNER_PERMISSIONS.read)));
}

/** Người phụ trách của nhiều khách (hộp thư, hộp yêu cầu báo giá): mỗi khách một lần đọc, dùng chung cache. */
export function useSalesOwners(customerIds: readonly string[]): ReadonlyMap<string, SalesOwner> {
  const can = usePermissionChecker();
  const enabled = can(SALES_OWNER_PERMISSIONS.read);
  const ids = [...new Set(customerIds.filter(Boolean))];
  const results = useQueries({ queries: ids.map((id) => ownerQuery(id, enabled)) });
  const owners = new Map<string, SalesOwner>();
  ids.forEach((id, index) => {
    const data = results[index]?.data;
    if (data) owners.set(id, data);
  });
  return owners;
}

export interface SalesOwnerAccessState extends SalesOwnerAccess {
  /** Tải lại người phụ trách (BE vừa báo người phụ trách khác với màn đang hiện). */
  refresh: () => void;
}

/**
 * BR-S12 cho người đang đăng nhập trên một khách: được làm không, vì sao, và có đang lo thay không. UI-only — Backend
 * phải re-check (`SalesOwnership.mayActFor`).
 */
export function useSalesOwnerAccess(customerId: string | null | undefined): SalesOwnerAccessState {
  const can = usePermissionChecker();
  const meId = useAuthStore((state) => state.user?.userId ?? null);
  const queryClient = useQueryClient();
  const query = useSalesOwner(customerId);
  const access = salesOwnerAccessOf(query.data, meId, can(SALES_OWNER_PERMISSIONS.update));
  return {
    ...access,
    refresh: () => {
      if (customerId)
        void queryClient.invalidateQueries({ queryKey: salesOwnerAccessKeys.one(customerId) });
    },
  };
}
