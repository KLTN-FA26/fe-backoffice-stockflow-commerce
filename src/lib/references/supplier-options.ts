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
  /** BR-PRD-11: chỉ NCC in gia công mới nhận được phần LSX tách ra. */
  printSubcontractor: z.boolean().nullish(),
});

const supplierOptionPageSchema = z.object({ items: z.array(supplierOptionSchema) });

export type SupplierOption = z.infer<typeof supplierOptionSchema>;

export const supplierOptionKeys = {
  all: ["references", "suppliers"] as const,
  active: () => [...supplierOptionKeys.all, "active"] as const,
  subcontractors: () => [...supplierOptionKeys.all, "print-subcontractors"] as const,
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

/** `enabled=false` khi người dùng không có `procurement-suppliers:READ` (tránh gọi để nhận 403). */
export function useSupplierOptions(enabled = true) {
  return useQuery({
    queryKey: supplierOptionKeys.active(),
    queryFn: ({ signal }) => fetchActiveSupplierOptions(signal),
    enabled,
    ...QUERY_TIMES.master,
  });
}

/**
 * Nhà gia công in đang hoạt động (SCRUM-441): `GET /suppliers?printSubcontractor=true` (BE PR #109). Lọc lại ở
 * client theo cờ trong từng NCC — BE cũ bỏ qua tham số lạ sẽ trả mọi NCC, khi đó vẫn chỉ hiện nhà gia công in.
 */
export async function fetchPrintSubcontractorOptions(
  signal?: AbortSignal,
): Promise<SupplierOption[]> {
  const params = new URLSearchParams({
    page: "0",
    size: String(PAGE_SIZE.masterData),
    status: "ACTIVE",
    printSubcontractor: "true",
    sort: "name,asc",
  });
  const { data } = await api.get<unknown>("/suppliers", { params, signal });
  return supplierOptionPageSchema
    .parse(data)
    .items.filter((supplier) => supplier.printSubcontractor === true);
}

/** `enabled=false` khi người dùng không có `procurement-suppliers:READ`. */
export function usePrintSubcontractorOptions(enabled = true) {
  return useQuery({
    queryKey: supplierOptionKeys.subcontractors(),
    queryFn: ({ signal }) => fetchPrintSubcontractorOptions(signal),
    enabled,
    ...QUERY_TIMES.master,
  });
}
