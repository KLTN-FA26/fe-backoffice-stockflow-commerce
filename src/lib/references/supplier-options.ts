/**
 * Danh sách NCC đang hoạt động cho module khác (vd tạo PO) — nguồn NCC dùng chung.
 *
 * Đặt ở `lib/` để module khác dùng mà không import `features/supplier` (feature-architecture:
 * feature A không import feature B). Gọi đúng API NCC của BE PR #36, schema tối giản.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

const supplierOptionSchema = z.object({
  supplierId: z.string().min(1),
  code: z.string(),
  name: z.string(),
  paymentTermDays: z.number().int(),
  leadTimeDays: z.number().int(),
});

const supplierOptionPageSchema = z.object({ items: z.array(supplierOptionSchema) });

export type SupplierOption = z.infer<typeof supplierOptionSchema>;

export const supplierOptionKeys = {
  all: ["references", "suppliers"] as const,
  active: () => [...supplierOptionKeys.all, "active"] as const,
};

export async function fetchActiveSupplierOptions(signal?: AbortSignal): Promise<SupplierOption[]> {
  const params = new URLSearchParams({
    page: "0",
    size: String(PAGE_SIZE.masterData),
    status: "ACTIVE",
    sort: "name,asc",
  });
  const { data } = await api.get<unknown>("/suppliers", { params, signal });
  return supplierOptionPageSchema.parse(data).items;
}

export function useSupplierOptions() {
  return useQuery({
    queryKey: supplierOptionKeys.active(),
    queryFn: ({ signal }) => fetchActiveSupplierOptions(signal),
    ...QUERY_TIMES.master,
  });
}
