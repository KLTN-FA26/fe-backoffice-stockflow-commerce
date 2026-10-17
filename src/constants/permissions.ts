/**
 * Mã quyền thật của BE (`<resource>:<ACTION>`), đọc từ `GET /identity/me/permissions`
 * (BE PR #39). Không gắn cứng theo tên vai trò — admin đổi quyền trên màn Phân quyền là
 * có hiệu lực ngay.
 */

/** Màn NCC — resource `procurement-suppliers` (BE SupplierController, PR #36). */
export const SUPPLIER_PERMISSIONS = {
  viewPage: "procurement-suppliers:VIEW_PAGE",
  read: "procurement-suppliers:READ",
  create: "procurement-suppliers:CREATE",
  // Sửa và đổi trạng thái qua PUT có `status`
  update: "procurement-suppliers:UPDATE",
  // Ngừng hợp tác = DELETE
  delete: "procurement-suppliers:DELETE",
  // Xuất dữ liệu hàng loạt — BE coi là quyền nhạy cảm, tách khỏi READ (Action.EXPORT)
  export: "procurement-suppliers:EXPORT",
} as const;

/**
 * Đơn hàng — resource `sales-orders` (BE `OrderResources.ORDERS`). Huỷ đơn phía admin
 * (`POST /orders/{id}/admin-cancellation`) yêu cầu APPROVE scope ALL; seed BE chỉ cấp cho
 * ORDER_COORDINATOR (SALES_STAFF chỉ có VIEW_PAGE/READ/CREATE/UPDATE).
 */
export const ORDER_PERMISSIONS = {
  // Mở trang (menu + chặn route) — BE Action.VIEW_PAGE, ADR-0004
  viewPage: "sales-orders:VIEW_PAGE",
  // Đọc dữ liệu (GET /orders, /orders/{id}) — seed BE: SALES_STAFF, ORDER_COORDINATOR
  read: "sales-orders:READ",
  cancel: "sales-orders:APPROVE",
} as const;

/**
 * Phiếu nhận hàng — resource `procurement-goods-receipts` (BE GoodsReceiptController, PR #62).
 * Kiểm đếm, xác nhận, huỷ DRAFT và chuyển hàng sang khu QC đều là UPDATE.
 */
export const GOODS_RECEIPT_PERMISSIONS = {
  viewPage: "procurement-goods-receipts:VIEW_PAGE",
  read: "procurement-goods-receipts:READ",
  create: "procurement-goods-receipts:CREATE",
  update: "procurement-goods-receipts:UPDATE",
  approve: "procurement-goods-receipts:APPROVE",
} as const;

/**
 * Kết luận QC dòng nhận — resource `procurement-qc-tasks` (BE `POST …/lines/{id}/inspection`,
 * PR #62). Tách khỏi quyền phiếu nhận: NV QC kết luận, NV kho không (docs 03 §2).
 */
export const QC_TASK_PERMISSIONS = {
  viewPage: "procurement-qc-tasks:VIEW_PAGE",
  read: "procurement-qc-tasks:READ",
  approve: "procurement-qc-tasks:APPROVE",
} as const;

/**
 * Màn Đơn đặt NCC — resource `procurement-purchase-orders` (BE PurchaseOrderController).
 * VIEW_PAGE chỉ dùng cho menu + chặn route; mọi API đọc cần READ (BE Action.java, ADR-0004).
 */
export const PO_PERMISSIONS = {
  viewPage: "procurement-purchase-orders:VIEW_PAGE",
  read: "procurement-purchase-orders:READ",
  create: "procurement-purchase-orders:CREATE",
  // Gửi NCC, huỷ, nhận hàng, đóng thiếu, ghi nhận NCC phản hồi
  update: "procurement-purchase-orders:UPDATE",
  // Phê duyệt + khôi phục gửi NCC (`/delivery-recovery`)
  approve: "procurement-purchase-orders:APPROVE",
  export: "procurement-purchase-orders:EXPORT",
} as const;

/**
 * Sản phẩm, biến thể, logistics theo SKU, ảnh theo biến thể — resource `product-products`
 * (BE ProductResources.PRODUCTS, PR #71).
 */
export const PRODUCT_PERMISSIONS = {
  viewPage: "product-products:VIEW_PAGE",
  read: "product-products:READ",
  create: "product-products:CREATE",
  // Sửa nháp, thêm / sửa / chặn biến thể, logistics, tải ảnh lên
  update: "product-products:UPDATE",
  // Duyệt (bốn mắt), kích hoạt / ngừng biến thể, xuất bản ảnh
  approve: "product-products:APPROVE",
} as const;

/**
 * Điều chỉnh tồn + sổ kho — BE `StockOperationsController` (develop 0f18f24), resource
 * `InventoryResources.STOCK_ITEMS` / `STOCK_ADJUSTMENTS` / `STOCK_MOVEMENTS`.
 */
export const INVENTORY_PERMISSIONS = {
  // Mở trang (menu + chặn route) — BE Action.VIEW_PAGE, ADR-0004; seed cấp kèm READ
  adjustmentViewPage: "inventory-stock-adjustments:VIEW_PAGE",
  movementViewPage: "inventory-stock-movements:VIEW_PAGE",
  // GET /inventory/adjustments, /inventory/adjustments/{id}
  adjustmentRead: "inventory-stock-adjustments:READ",
  // POST …/approval và …/rejection — bốn mắt vẫn do lifecycle + BE kiểm
  adjustmentApprove: "inventory-stock-adjustments:APPROVE",
  // POST /inventory/adjustments (tạo) và …/withdrawal (rút) — việc của NV kho
  stockUpdate: "inventory-stock-items:UPDATE",
  // GET /inventory/movements
  movementRead: "inventory-stock-movements:READ",
} as const;

/**
 * Task xuất kho — resource `fulfillment-pick-lists` (BE FulfillmentController, SCRUM-43).
 * Tạo task, gán, bắt đầu / hoàn tất lấy hàng đều là UPDATE (không có CREATE).
 */
export const FULFILLMENT_PICK_PERMISSIONS = {
  viewPage: "fulfillment-pick-lists:VIEW_PAGE",
  read: "fulfillment-pick-lists:READ",
  update: "fulfillment-pick-lists:UPDATE",
} as const;

/**
 * Đóng gói — resource `fulfillment-packages` (BE FulfillmentResources.PACKAGES). READ = tải
 * artifact thiết kế; CREATE = xác nhận đóng gói và kiểm tra lại thiết kế (flow X-CHK).
 */
export const FULFILLMENT_PACKAGE_PERMISSIONS = {
  viewPage: "fulfillment-packages:VIEW_PAGE",
  read: "fulfillment-packages:READ",
  create: "fulfillment-packages:CREATE",
} as const;

/** Danh sách tài khoản nhân viên — `GET /identity/users` (BE UserManagementController). */
export const IDENTITY_USER_PERMISSIONS = {
  read: "identity-users:READ",
} as const;

/**
 * Mã vai trò BE (`common/security/Roles.java`), trả trong `/identity/me/permissions.roles`.
 * Chỉ dùng ở nơi BE gate kép bằng `@PreAuthorize` theo vai trò (FulfillmentController) — các
 * màn khác gate theo mã quyền.
 */
export const STAFF_ROLE = {
  ORDER_COORDINATOR: "ORDER_COORDINATOR",
  QC_STAFF: "QC_STAFF",
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  WAREHOUSE_MANAGER: "WAREHOUSE_MANAGER",
  WAREHOUSE_STAFF: "WAREHOUSE_STAFF",
} as const;

export type StaffRole = (typeof STAFF_ROLE)[keyof typeof STAFF_ROLE];

/**
 * Lệnh chuyển kho — resource `inventory-transfer-orders` (BE TransferOrderController, SCRUM-326/327).
 * Tạo / sửa nháp / gửi duyệt / huỷ = CREATE; lấy hàng / xuất kho ở kho nguồn = UPDATE; duyệt / từ chối
 * = APPROVE (seed BE: chỉ WAREHOUSE_MANAGER).
 */
export const TRANSFER_PERMISSIONS = {
  viewPage: "inventory-transfer-orders:VIEW_PAGE",
  read: "inventory-transfer-orders:READ",
  create: "inventory-transfer-orders:CREATE",
  update: "inventory-transfer-orders:UPDATE",
  approve: "inventory-transfer-orders:APPROVE",
} as const;

/**
 * Xếp xe & bàn giao hãng — resource `fulfillment-shipments` (đã seed V20260903000100, cấp cho
 * WAREHOUSE_STAFF / WAREHOUSE_MANAGER / ORDER_COORDINATOR).
 * ASSUMPTION: BE SCRUM-288 chưa có controller; dùng resource đã seed cho endpoint chuyến xe.
 */
export const SHIPMENT_PERMISSIONS = {
  viewPage: "fulfillment-shipments:VIEW_PAGE",
  read: "fulfillment-shipments:READ",
  create: "fulfillment-shipments:CREATE",
  update: "fulfillment-shipments:UPDATE",
} as const;

/** BE develop IdentityResources / IdentityController: read-only RBAC screen APIs. */
export const IDENTITY_PERMISSIONS = {
  rolesRead: "identity-roles:READ",
  rbacRead: "identity-rbac:READ",
  rbacApprove: "identity-rbac:APPROVE",
} as const;

export const PERMISSION_QUERY = {
  path: "/identity/me/permissions",
  staleTime: 30_000,
} as const;
export const PERMISSION_UI = {
  deniedTitle: "Không có quyền truy cập",
  deniedDescription: "Bạn không có quyền mở trang này.",
  errorTitle: "Không thể tải quyền truy cập",
  retry: "Thử lại",
  productCreateDenied: "Bạn không có quyền tạo sản phẩm.",
  demoContext: "Chỉ đổi nhãn vai trò demo; quyền vẫn lấy từ phiên đăng nhập.",
} as const;
