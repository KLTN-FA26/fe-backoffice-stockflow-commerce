/**
 * Danh sách kho đang hoạt động cho module khác (vd chọn kho nhận khi tạo PO — SCRUM-390, BE PR #71).
 *
 * Đặt ở `lib/` để module khác dùng mà không import feature kho (feature-architecture).
 * BE `GET /warehouses` trả `{ id, prefix, name, … }`; mock cũ trả `{ warehouseId, code, name }` —
 * schema nhận cả hai rồi chuẩn hoá.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

const warehouseOptionSchema = z
  .object({
    id: z.string().min(1).optional(),
    warehouseId: z.string().min(1).optional(),
    prefix: z.string().optional(),
    code: z.string().optional(),
    name: z.string(),
  })
  .transform((w) => ({
    warehouseId: w.id ?? w.warehouseId ?? "",
    code: w.prefix ?? w.code ?? "",
    name: w.name,
  }))
  .refine((w) => w.warehouseId !== "", "Kho thiếu id");

const warehouseOptionPageSchema = z.object({ items: z.array(warehouseOptionSchema) });

export type WarehouseOption = z.infer<typeof warehouseOptionSchema>;

export const warehouseOptionKeys = {
  all: ["references", "warehouses"] as const,
  active: () => [...warehouseOptionKeys.all, "active"] as const,
};

export async function fetchActiveWarehouseOptions(
  signal?: AbortSignal,
): Promise<WarehouseOption[]> {
  const params = new URLSearchParams({
    page: "0",
    size: String(PAGE_SIZE.masterData),
    status: "ACTIVE",
    sort: "name,asc",
  });
  const { data } = await api.get<unknown>("/warehouses", { params, signal });
  return warehouseOptionPageSchema.parse(data).items;
}

export function useWarehouseOptions() {
  return useQuery({
    queryKey: warehouseOptionKeys.active(),
    queryFn: ({ signal }) => fetchActiveWarehouseOptions(signal),
    ...QUERY_TIMES.master,
  });
}
