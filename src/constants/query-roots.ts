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
  /**
   * Task xuất kho — gồm cả hàng chờ và phiên kiểm thùng (`cartonCheckKeys` nằm dưới root này). Đổi cách giao của đơn
   * (Sales cho phép / dừng giao một phần) đổi việc kho được phép làm, nên Order invalidate qua root này.
   */
  fulfillmentTasks: "fulfillment-tasks",
  /**
   * Danh mục loại xe (`GET /fulfillment/vehicle-types`) — feature `vehicle-type` sở hữu, còn ô chọn loại xe của ước tính xếp xe
   * (`load-planning`, không import chéo) build key dưới đúng root này nên thêm / sửa / ngừng dùng loại xe làm mới cả hai.
   */
  vehicleTypes: "fulfillment-vehicle-types",
  /** Chuyến xe giao hãng vận chuyển — thêm lô vào chuyến / bàn giao phụ thuộc cờ giao một phần của đơn. */
  fulfillmentLoads: "fulfillment-loads",
  /**
   * Danh mục đơn vị sản xuất — feature `producer` sở hữu; ô chọn / tra tên đơn vị của Đơn sản xuất
   * (`lib/references/producer-options`) build key dưới root này nên thêm / sửa / ngừng dùng làm mới cả hai.
   */
  producers: "sales-producers",
  /**
   * Đơn bán — feature `order` sở hữu (`orderKeys.all`). Đơn sản xuất được gửi / nhận đổi trạng thái đơn bán (Awaiting
   * Stock) và phần "đơn sản xuất" trên trang đơn, nên feature `production-order` invalidate qua root này.
   */
  salesOrders: "orders",
  /**
   * Đơn sản xuất — feature `production-order` sở hữu (`createQueryKeys("production-orders")`). Phiếu nhập
   * (`lib/references/production-orders`) đọc Đơn sản xuất dưới root này; xác nhận phiếu đổi số thùng đã nhận và trạng
   * thái Đơn sản xuất (docs 03 §4.1 bước 6) nên invalidate root làm mới cả hai.
   */
  productionOrders: "production-orders",
  /** Lịch sản xuất + đợt giao còn thiếu — lập / gửi / huỷ Đơn sản xuất đổi cả hai danh sách (docs 17 §4.12). */
  productionSchedule: "production-schedule",
  /** Cảnh báo trễ của đơn (`GET /delay-alerts`) — tự đóng / mở khi Đơn sản xuất đổi ngày hoặc trạng thái. */
  delayAlerts: "delay-alerts",
  /**
   * Bảng sức chứa kho — feature `warehouse-capacity` sở hữu (`capacityKeys.all`). Lập / gửi / huỷ Đơn sản xuất đổi "chờ
   * gửi" và "sắp nhập" của kho nhận (docs 06 §4.6), nên `production-order` invalidate qua root này.
   */
  warehouseCapacity: "warehouse-capacity",
} as const;
