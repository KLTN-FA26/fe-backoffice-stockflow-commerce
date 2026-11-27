import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { QUARANTINE_QUERY_KEYS } from "@/constants/quarantine";

import { getCartonLookup, listCartonLookup } from "./carton-api";
import { cartonKeys } from "./quarantine-queries";

import type { CartonListParams } from "./carton-schemas";

/**
 * Khoá của màn Thùng hàng nằm dưới `cartonKeys.all`: cách ly / gỡ cách ly (invalidate `cartonKeys.all`) làm mới luôn
 * danh sách và chi tiết ở đây. Không theo kho của app: lọc kho là tham số `warehouseId` của chính màn này.
 */
export const cartonLookupKeys = {
  list: (params: CartonListParams) =>
    [...cartonKeys.all, QUARANTINE_QUERY_KEYS.lookup, params] as const,
  detail: (lpn: string) => [...cartonKeys.all, QUARANTINE_QUERY_KEYS.lookupDetail, lpn] as const,
};

/** Đổi lọc / trang giữ trang cũ trên màn tới khi trang mới về — bảng không nháy rỗng. */
export function useCartonLookup(params: CartonListParams, enabled: boolean) {
  return useQuery({
    queryKey: cartonLookupKeys.list(params),
    queryFn: ({ signal }) => listCartonLookup(params, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Chi tiết một thùng (panel) — chỉ gọi khi đang mở; 404 LPN sai không tự thử lại (QueryClient bỏ qua 4xx). */
export function useCartonLookupDetail(lpn: string | null, enabled: boolean) {
  return useQuery({
    queryKey: cartonLookupKeys.detail(lpn ?? ""),
    queryFn: ({ signal }) => getCartonLookup(lpn ?? "", signal),
    enabled: enabled && Boolean(lpn),
  });
}
