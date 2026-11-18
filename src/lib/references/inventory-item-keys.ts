/**
 * Khoá query hồ sơ hàng tồn (BE `/inventory/items`) dùng chung giữa `features/inventory-item` và các module
 * khác (ô chọn SKU, màn biến thể) — đặt ở `lib/` để không import chéo feature.
 */

/** Tham số danh sách `GET /inventory/items`; `page` 0-based. */
export interface InventoryItemListParams {
  page: number;
  size: number;
  /** Tìm theo SKU hoặc mã vạch. */
  q?: string;
}

export const inventoryItemKeys = {
  all: ["inventory-items"] as const,
  lists: () => [...inventoryItemKeys.all, "list"] as const,
  list: (params: InventoryItemListParams) => [...inventoryItemKeys.all, "list", params] as const,
  detail: (id: string) => [...inventoryItemKeys.all, "detail", id] as const,
};
