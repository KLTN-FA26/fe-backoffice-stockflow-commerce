import type { useInventoryListFilters } from "../use-list-filters";
import type { AdjustmentPage, MovementPage } from "../types";

type ListState = ReturnType<typeof useInventoryListFilters>;

/**
 * Nối trang BE (0-based) vào phân trang server của `DataTable`; URL giữ trang 1-based.
 * Nút sau / trước theo `hasNext` / `hasPrevious` của BE, không đoán từ số dòng.
 */
export function serverPage(data: AdjustmentPage | MovementPage, state: ListState) {
  return {
    page: data.page,
    size: data.size,
    totalElements: data.totalElements,
    totalPages: data.totalPages,
    hasNext: data.hasNext,
    hasPrevious: data.hasPrevious,
    onPageChange: (page: number) => void state.setPage(page + 1),
    onPageSizeChange: state.setSize,
  };
}
