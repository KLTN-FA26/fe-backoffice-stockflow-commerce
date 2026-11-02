/**
 * Khu vực trong kho (BE `GET /warehouses/{id}/layout`, `warehouse-locations:READ`) — dùng chọn
 * vị trí đích khi xuất phôi (khu PRODUCTION) và khu đóng gói khi QC hoàn tất (khu PACKING).
 * Vai trò thiếu quyền (QC, sản xuất) → hook tắt; form cho nhập / quét mã vị trí, BE kiểm tra.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

export const AREA_TYPES = [
  "RECEIVING",
  "QUALITY_CONTROL",
  "QUARANTINE",
  "PACKING",
  "DISPATCH",
  "OVERFLOW",
  "PRODUCTION",
  "NON_STORAGE",
] as const;
export type AreaType = (typeof AREA_TYPES)[number];

const areaSchema = z
  .object({
    code: z.string(),
    type: z.enum(AREA_TYPES),
    name: z.string().nullish(),
    usable: z.boolean().nullish(),
    locationCode: z.string().nullish(),
  })
  .loose();
const layoutSchema = z.object({ areas: z.array(areaSchema) }).loose();

export interface AreaOption {
  locationCode: string;
  label: string;
  type: AreaType;
}

export function useWarehouseAreas(warehouseId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["references", "warehouse-layout", warehouseId ?? ""],
    queryFn: async ({ signal }): Promise<AreaOption[]> => {
      const { data } = await api.get<unknown>(
        `/warehouses/${encodeURIComponent(warehouseId ?? "")}/layout`,
        { signal },
      );
      return layoutSchema
        .parse(data)
        .areas.filter((area) => area.usable !== false && !!area.locationCode)
        .map((area) => ({
          locationCode: area.locationCode ?? area.code,
          label: area.name
            ? `${area.locationCode} — ${area.name}`
            : (area.locationCode ?? area.code),
          type: area.type,
        }));
    },
    enabled: enabled && !!warehouseId,
    ...QUERY_TIMES.master,
  });
}
