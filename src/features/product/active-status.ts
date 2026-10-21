/**
 * Thuộc tính / thương hiệu / danh mục chỉ có cờ `active` (BE) → map sang mã trạng thái sẵn có
 * trong status-map để `StatusDot` hiện dot đúng tone, nhãn "Đang dùng" / "Ngừng dùng".
 */
export const activeStatus = (active: boolean): "ACTIVE" | "OBSOLETE" =>
  active ? "ACTIVE" : "OBSOLETE";
