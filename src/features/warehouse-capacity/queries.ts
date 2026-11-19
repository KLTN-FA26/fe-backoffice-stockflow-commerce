import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { getCapacityBoard, getFactorWarehouse, listCapacityBoards } from "./api";

import type { CapacityBoard } from "./types";

/** Khoá gốc `warehouse-capacity` = mã resource BE. Đổi hệ số làm mới cả danh sách lẫn chi tiết qua `all`. */
export const capacityKeys = {
  all: ["warehouse-capacity"] as const,
  list: () => [...capacityKeys.all, "list"] as const,
  detail: (warehouseId: string) => [...capacityKeys.all, "detail", warehouseId] as const,
  warehouse: (warehouseId: string) => [...capacityKeys.all, "warehouse", warehouseId] as const,
};

/** Mọi kho người dùng được xem — bảng tính lúc đọc (BR-20) nên giữ staleTime ngắn của danh sách. */
export function useCapacityBoards(enabled = true) {
  return useQuery({
    queryKey: capacityKeys.list(),
    queryFn: ({ signal }) => listCapacityBoards(signal),
    enabled,
    ...QUERY_TIMES.list,
  });
}

/** Bảng của một kho; `placeholder` (dòng của danh sách) hiện ngay trong lúc tải bản mới nhất. */
export function useCapacityBoard(warehouseId: string | null, placeholder?: CapacityBoard) {
  return useQuery({
    queryKey: capacityKeys.detail(warehouseId ?? ""),
    queryFn: ({ signal }) => getCapacityBoard(warehouseId ?? "", signal),
    enabled: Boolean(warehouseId),
    placeholderData: placeholder,
    ...QUERY_TIMES.list,
  });
}

/** Bản kho mới nhất (tên, địa chỉ, khung, `version`) — chỉ khi mở hộp sửa hệ số. */
export function useFactorWarehouse(warehouseId: string, enabled: boolean) {
  return useQuery({
    queryKey: capacityKeys.warehouse(warehouseId),
    queryFn: ({ signal }) => getFactorWarehouse(warehouseId, signal),
    enabled,
    staleTime: 0,
    gcTime: QUERY_TIMES.detail.gcTime,
  });
}
