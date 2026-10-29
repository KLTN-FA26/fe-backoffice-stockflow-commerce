import type { InventoryPageMeta } from "./InventoryPager";

type ListState = { setPage: (page: number) => unknown; setSize: (size: number) => void };

/**
 * Nối trang BE (0-based) vào phân trang server của `DataTable` — một bộ phân trang duy nhất như các
 * trang danh sách khác; URL giữ trang 1-based. Trước / sau theo `hasPrevious` / `hasNext` của BE.
 */
export function serverPage(data: InventoryPageMeta, state: ListState) {
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
export const isInvalidPage = (data: InventoryPageMeta) =>
  data.items.length === 0 && data.totalElements > 0;
