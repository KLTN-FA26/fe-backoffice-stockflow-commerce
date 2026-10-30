import type { useInventoryListFilters } from "../use-list-filters";
import type { AdjustmentPage, MovementPage } from "../types";

type ListState = ReturnType<typeof useInventoryListFilters>;

/**
 * Nối trang BE (0-based) vào phân trang server của `DataTable` — một bộ phân trang duy nhất như các
 * trang danh sách khác; URL giữ trang 1-based. Trước / sau theo `hasPrevious` / `hasNext` của BE.
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

/** Trang hiện tại rỗng trong khi BE vẫn có dữ liệu → `?page` vượt số trang. */
export const isInvalidPage = (data: AdjustmentPage | MovementPage) =>
  data.items.length === 0 && data.totalElements > 0;
