/**
 * Root query key dùng chung giữa các feature — hợp đồng cache liên module.
 *
 * Feature KHÔNG import chéo nhau (feature-architecture.md), nên feature phát sinh thay đổi
 * (vd Order huỷ / release làm đổi giữ chỗ tồn) invalidate qua root ở đây, còn feature sở hữu
 * dữ liệu (Inventory) build key của mình dưới đúng root này.
 *
 * `inventoryStock` trùng giá trị `INVENTORY_QUERY_KEYS.stock` bên nhánh Inventory — khi gộp,
 * Inventory nên trỏ hằng của mình về đây để hai bên không lệch chuỗi.
 */
export const SHARED_QUERY_ROOTS = {
  /** Tồn theo SKU / lô / vị trí — reserved + available đổi khi giữ chỗ đổi. */
  inventoryStock: "inventory-stock-items",
  /** Phiếu giữ hàng (reservation) — trạng thái + hạn giữ chỗ. */
  inventoryReservations: "inventory-stock-reservations",
} as const;
