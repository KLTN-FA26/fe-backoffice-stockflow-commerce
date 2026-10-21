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
 * Danh mục hàng của NCC — resource `procurement-supplier-items` (BE SupplierItemController).
 * Seed V20260928006000 chỉ cấp đủ 5 action cho PROCUREMENT_STAFF (ACCOUNTANT,
 * ECOMMERCE_ADMIN không có).
 */
export const SUPPLIER_ITEM_PERMISSIONS = {
  viewPage: "procurement-supplier-items:VIEW_PAGE",
  read: "procurement-supplier-items:READ",
  create: "procurement-supplier-items:CREATE",
  update: "procurement-supplier-items:UPDATE",
  delete: "procurement-supplier-items:DELETE",
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
 * Sản phẩm, giá bán, ảnh theo biến thể — resource `product-products` (BE ProductResources.PRODUCTS,
 * PR #71). Logistics / chính sách tồn của SKU là `inventory-inventory-items` (BE PR #119).
 */
export const PRODUCT_PERMISSIONS = {
  viewPage: "product-products:VIEW_PAGE",
  read: "product-products:READ",
  create: "product-products:CREATE",
  // Sửa nháp, listing / giá bán, tải ảnh lên (biến thể là `product-variants`)
  update: "product-products:UPDATE",
  // Duyệt (bốn mắt), xuất bản / gỡ xuất bản, xuất bản ảnh
  approve: "product-products:APPROVE",
  // Tạm ngưng / tiếp tục / ngừng kinh doanh — resource riêng `product-lifecycle` (BE
  // `ProductLifecycleController`, PR #123): kltn-docs 01 §5.1 chỉ giao cho System Admin
  lifecycle: "product-lifecycle:APPROVE",
  // Xoá sản phẩm Nháp (`DELETE /products/{id}`) — quyền riêng, có thể cấp hoặc thu hồi tách biệt
  delete: "product-products:DELETE",
} as const;

/**
 * Cấu trúc biến thể — resource `product-variants` (BE `ProductResources.VARIANTS`, khai báo ở
 * `ProductAttributeController`): trục biến thể (`PUT /products/{id}/axes`), thêm biến thể và sinh ma
 * trận là CREATE, sửa / chặn là UPDATE, kích hoạt / ngừng dùng là APPROVE. Khác với nội dung sản phẩm
 * (`product-products`), nên SALES_STAFF có quyền này mà không có quyền duyệt sản phẩm.
 */
export const VARIANT_PERMISSIONS = {
  viewPage: "product-variants:VIEW_PAGE",
  read: "product-variants:READ",
  create: "product-variants:CREATE",
  update: "product-variants:UPDATE",
  approve: "product-variants:APPROVE",
} as const;

/**
 * Từ điển thuộc tính — resource `product-attributes` (BE `AttributeController`,
 * `CategoryAttributeController`). Thêm / sửa / xoá một giá trị là UPDATE của thuộc tính (không có
 * quyền riêng cho giá trị); gán bộ thuộc tính cho danh mục cũng là UPDATE.
 */
export const ATTRIBUTE_PERMISSIONS = {
  viewPage: "product-attributes:VIEW_PAGE",
  read: "product-attributes:READ",
  create: "product-attributes:CREATE",
  update: "product-attributes:UPDATE",
  delete: "product-attributes:DELETE",
} as const;

/**
 * Điều chỉnh tồn + sổ kho — BE `StockOperationsController` (develop 0f18f24), resource
 * `InventoryResources.STOCK_ITEMS` / `STOCK_ADJUSTMENTS` / `STOCK_MOVEMENTS`.
 */
export const INVENTORY_PERMISSIONS = {
  // GET /inventory/adjustments, /inventory/adjustments/{id}
  adjustmentRead: "inventory-stock-adjustments:READ",
  // POST …/approval và …/rejection — bốn mắt vẫn do lifecycle + BE kiểm
  adjustmentApprove: "inventory-stock-adjustments:APPROVE",
  // POST /inventory/adjustments (tạo) và …/withdrawal (rút) — việc của NV kho
  stockUpdate: "inventory-stock-items:UPDATE",
  // GET /inventory/movements
  movementRead: "inventory-stock-movements:READ",
  // GET /inventory/stock-items?sku= (tồn theo SKU và vị trí) — gợi ý nguồn khi chuyển vị trí
  stockRead: "inventory-stock-items:READ",
  // GET /inventory/alerts, /inventory/alerts/summary (BE StockAlertController, resource inventory-alerts)
  alertRead: "inventory-alerts:READ",
} as const;

/**
 * Hồ sơ hàng tồn (logistics + chính sách tồn của một SKU) — resource `inventory-inventory-items`
 * (BE PR #119 `InventoryItemController`, chỉ khai báo VIEW_PAGE / READ / UPDATE). Seed
 * V20260928006000: WAREHOUSE_MANAGER, INVENTORY_PLANNER mọi quyền; WAREHOUSE_STAFF,
 * PROCUREMENT_STAFF chỉ VIEW_PAGE / READ. Role catalog (ECOMMERCE_ADMIN, SALES_STAFF) không có quyền.
 */
export const INVENTORY_ITEM_PERMISSIONS = {
  viewPage: "inventory-inventory-items:VIEW_PAGE",
  // GET /inventory/items, GET /inventory/items/{id}
  read: "inventory-inventory-items:READ",
  // PUT /inventory/items/{id}/logistics, PUT …/policy
  update: "inventory-inventory-items:UPDATE",
} as const;

/**
 * Sơ đồ kho — resource `warehouse-locations` (BE `LayoutController`): `GET /warehouses/{id}/layout`
 * và `GET /locations/{code}`. WAREHOUSE_STAFF có VIEW_PAGE/READ (seed V20260928006000).
 */
export const WAREHOUSE_LOCATION_PERMISSIONS = {
  read: "warehouse-locations:READ",
} as const;

/**
 * Tổng quan tồn kho (SCRUM-438) — resource `InventoryResources.STOCK_ITEMS` / `RESERVATIONS` /
 * `ALERTS`. Tồn kho và giữ chỗ là hai resource riêng; seed BE V20260903000100.
 */
export const INVENTORY_OVERVIEW_PERMISSIONS = {
  stockViewPage: "inventory-stock-items:VIEW_PAGE",
  stockRead: "inventory-stock-items:READ",
  reservationViewPage: "inventory-reservations:VIEW_PAGE",
  reservationRead: "inventory-reservations:READ",
  // GET /inventory/alerts (StockAlertController, READ) — cảnh báo nhúng trong màn tổng quan, không
  // có menu riêng nên không cần VIEW_PAGE. Seed V20261014000900.
  alertRead: "inventory-alerts:READ",
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

/**
 * Danh mục kho — resource `warehouse-warehouses` (BE WarehouseController: GET /warehouses = READ).
 * Seed V20260928006000: WAREHOUSE_MANAGER, WAREHOUSE_STAFF, INVENTORY_PLANNER, PROCUREMENT_STAFF;
 * V20261017000800 thêm SALES_STAFF; QC_STAFF không có.
 */
export const WAREHOUSE_PERMISSIONS = {
  read: "warehouse-warehouses:READ",
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
