import { useQuery } from "@tanstack/react-query";

import { QUARANTINE_QUERY_KEYS } from "@/constants/quarantine";

import { useAppStore } from "@/lib/store/use-app-store";

import { getCarton, listCartons } from "./quarantine-api";

import type { StockPackageListParams } from "./quarantine-types";

export const cartonKeys = {
  all: [QUARANTINE_QUERY_KEYS.carton] as const,
  detail: (lpn: string, warehouseId: string | null) =>
    [...cartonKeys.all, warehouseId, lpn] as const,
  /** Dưới `cartonKeys.all`: cách ly / gỡ cách ly (invalidate `cartonKeys.all`) làm mới cả danh sách khu. */
  list: (params: StockPackageListParams, warehouseId: string | null) =>
    [...cartonKeys.all, QUARANTINE_QUERY_KEYS.list, warehouseId, params] as const,
};

/** Chỉ tra khi đã có LPN; không tự thử lại 404 (LPN sai) — retry của QueryClient bỏ qua 4xx. */
export function useCarton(lpn: string) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: cartonKeys.detail(lpn, warehouseId),
    queryFn: ({ signal }) => getCarton(lpn, signal),
    enabled: Boolean(lpn),
  });
}

/** Thùng trong một khu cách ly — chỉ gọi khi đã có mã khu (không có `location`, BE trả mọi thùng của kho). */
export function useQuarantineCartons(params: StockPackageListParams) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: cartonKeys.list(params, warehouseId),
    queryFn: ({ signal }) => listCartons(params, signal),
    enabled: Boolean(params.location),
    placeholderData: (previous, query) =>
      query?.queryKey[2] === warehouseId ? previous : undefined,
  });
}
