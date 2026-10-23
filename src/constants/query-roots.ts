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
  /**
   * Task xuất kho — gồm cả hàng chờ và phiên đóng gói (`packingKeys` nằm dưới root này). Đổi cách giao của đơn
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
   * Lệnh chuyển kho — đóng gói xong / hoàn tất đóng gói đổi `packedAt`, trạng thái PICKING của lệnh (SCRUM-287 PR F9),
   * nên trạm đóng gói chuyển kho invalidate qua root này. `transferKeys` của feature Transfer build dưới đúng root này.
   */
  transferOrders: "transfer-orders",
  /** Kế hoạch xếp xe — đóng gói xong một lệnh chuyển kho làm lệnh đó thành ứng viên của kế hoạch (PR F9). */
  fulfillmentLoadPlans: "fulfillment-load-plans",
} as const;
