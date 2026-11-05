/**
 * Tra NCC theo id cho module khác (vd danh sách / chi tiết PO) — `GET /suppliers/{id}`.
 *
 * Khác `useSupplierOptions` (chỉ NCC ACTIVE cho form tạo): PO cũ vẫn phải hiện tên NCC đã ngừng
 * hợp tác, nên tra từng id. BE `PurchaseOrderResponse` không trả tên/mã NCC (BE #36).
 * Key nằm dưới `supplierOptionKeys.all` nên mọi mutation NCC (đã invalidate prefix đó) cũng làm
 * mới tên ở màn PO. Đặt ở `lib/` để không import `features/supplier`.
 */

import { useQueries, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

import { supplierOptionKeys } from "./supplier-options";

const supplierRefSchema = z.object({
  supplierId: z.string().min(1),
  code: z.string(),
  name: z.string(),
  status: z.string(),
  paymentTermDays: z.number().int(),
  leadTimeDays: z.number().int(),
});

export type SupplierRef = z.infer<typeof supplierRefSchema>;

export const supplierRefKeys = {
  byId: (id: string) => [...supplierOptionKeys.all, "by-id", id] as const,
};

export async function fetchSupplierRef(id: string, signal?: AbortSignal): Promise<SupplierRef> {
  const { data } = await api.get<unknown>(`/suppliers/${encodeURIComponent(id)}`, { signal });
  return supplierRefSchema.parse(data);
}

const refQuery = (id: string) => ({
  queryKey: supplierRefKeys.byId(id),
  queryFn: ({ signal }: { signal?: AbortSignal }) => fetchSupplierRef(id, signal),
  ...QUERY_TIMES.master,
  // 403/404 không tự hết khi thử lại — màn hình fallback về id NCC.
  retry: false,
});

export function useSupplierRef(id: string | null | undefined) {
  return useQuery({ ...refQuery(id ?? ""), enabled: !!id });
}

/** Tra nhiều NCC một lúc (vd các NCC trên một trang danh sách PO), bỏ trùng id. */
export function useSupplierRefs(ids: readonly string[]): ReadonlyMap<string, SupplierRef> {
  const unique = [...new Set(ids.filter(Boolean))];
  return useQueries({
    queries: unique.map(refQuery),
    combine: (results) => {
      const map = new Map<string, SupplierRef>();
      results.forEach((r) => {
        if (r.data) map.set(r.data.supplierId, r.data);
      });
      return map;
    },
  });
}
