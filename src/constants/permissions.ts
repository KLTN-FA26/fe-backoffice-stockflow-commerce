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
 * Đơn hàng — resource `sales-orders` (BE `OrderResources.ORDERS`).
 * - `approve` (APPROVE, scope ALL): giữ đơn, gỡ giữ, ghi giao thất bại (`OrderReleaseController`);
 *   seed BE chỉ cấp cho ORDER_COORDINATOR (SALES_STAFF chỉ có VIEW_PAGE/READ/CREATE/UPDATE).
 * - `cancel`: huỷ đơn phía admin (`POST /orders/{id}/admin-cancellation`) và đóng phần còn lại của
 *   đơn giao một phần (`POST /orders/{id}/remainder-closure`) — BE tách sang resource
 *   `sales-order-cancellations` (UPDATE, scope ALL; seed: ORDER_COORDINATOR + SALES_STAFF).
 * - `partialShipment`: Sales cho phép / dừng giao một phần của đơn — resource
 *   `sales-order-partial-shipments` (UPDATE, scope ALL; seed: SALES_STAFF + SYSTEM_ADMIN).
 */
export const ORDER_PERMISSIONS = {
  // Mở trang (menu + chặn route) — BE Action.VIEW_PAGE, ADR-0004
  viewPage: "sales-orders:VIEW_PAGE",
  // Đọc dữ liệu (GET /orders, /orders/{id}, /orders/{id}/history) — seed BE: SALES_STAFF,
  // ORDER_COORDINATOR và (BE PR #148, "ACCREAD") ACCOUNTANT
  read: "sales-orders:READ",
  approve: "sales-orders:APPROVE",
  cancel: "sales-order-cancellations:UPDATE",
  // Cho phép / dừng giao một phần của đơn (`PUT /orders/{id}/partial-shipment`, BE PR #150) — resource
  // `sales-order-partial-shipments` (UPDATE, scope ALL; seed: SALES_STAFF + SYSTEM_ADMIN)
  partialShipment: "sales-order-partial-shipments:UPDATE",
  // Chọn / đổi hình thức giao của đơn (`POST /orders/{id}/release` với `deliveryMode` khác của đơn và
  // `PUT /orders/{id}/delivery-mode`, BE PR #157, LP-1) — resource `sales-order-delivery-modes` (UPDATE,
  // scope ALL; seed: ORDER_COORDINATOR + SYSTEM_ADMIN). Đọc hình thức giao đi kèm `sales-orders:READ`.
  deliveryModes: "sales-order-delivery-modes:UPDATE",
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
 * Danh mục loại xe cho kế hoạch xếp xe (SCRUM-287) — resource `fulfillment-vehicle-types`
 * (BE PR #153 `VehicleTypeController`). READ: danh sách + chi tiết (nhân viên kho, quản lý kho,
 * điều phối đơn); UPDATE: thêm / sửa / ngừng dùng (quản lý kho). Không có DELETE.
 */
export const VEHICLE_TYPE_PERMISSIONS = {
  viewPage: "fulfillment-vehicle-types:VIEW_PAGE",
  read: "fulfillment-vehicle-types:READ",
  update: "fulfillment-vehicle-types:UPDATE",
} as const;

/**
 * Ước tính xếp xe trước đóng gói (SCRUM-287 PR EST, BE PR #160 `LoadEstimateController`) — resource
 * `fulfillment-load-estimates`. CREATE: tính ước tính (`POST /fulfillment/load-estimates`); READ: xem ước
 * tính hiện hành (`GET`). Seed: ORDER_COORDINATOR, WAREHOUSE_MANAGER, SYSTEM_ADMIN. Không có VIEW_PAGE:
 * ước tính mở từ chi tiết đơn, không có trang riêng.
 */
export const LOAD_ESTIMATE_PERMISSIONS = {
  create: "fulfillment-load-estimates:CREATE",
  read: "fulfillment-load-estimates:READ",
} as const;

/**
 * Kế hoạch xếp xe (SCRUM-287 PR D) — resource `fulfillment-load-plans`, BE `LoadPlanController`. READ: xem
 * danh sách, chi tiết, bố cục, đối chiếu (nhân viên kho, quản lý kho, điều phối đơn); CREATE: lập kế hoạch;
 * UPDATE: đổi đầu vào, tính, tính lại xe, xác nhận kiện chưa xếp, chốt, mở lại, huỷ (nhân viên kho, quản lý kho).
 */
export const LOAD_PLAN_PERMISSIONS = {
  viewPage: "fulfillment-load-plans:VIEW_PAGE",
  read: "fulfillment-load-plans:READ",
  create: "fulfillment-load-plans:CREATE",
  update: "fulfillment-load-plans:UPDATE",
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
 * Chỉ còn quyền ĐỌC: danh sách / chi tiết task và dòng lấy hàng. Mọi thao tác ghi đã tách sang các
 * resource riêng bên dưới (BE PR #148) — `fulfillment-pick-lists:UPDATE` không còn bảo vệ endpoint nào.
 */
export const FULFILLMENT_PICK_PERMISSIONS = {
  viewPage: "fulfillment-pick-lists:VIEW_PAGE",
  read: "fulfillment-pick-lists:READ",
} as const;

/**
 * Giao / gán task — resource `fulfillment-task-assignment` (BE PR #148). CREATE: tạo task
 * (`POST /fulfillment/tasks`); UPDATE: danh sách người nhận (`GET /fulfillment/assignees`) và gán lại
 * (`PUT /tasks/{id}/assignment`). Seed: ORDER_COORDINATOR, WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 */
export const FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS = {
  create: "fulfillment-task-assignment:CREATE",
  update: "fulfillment-task-assignment:UPDATE",
} as const;

/**
 * Giám sát task — resource `fulfillment-task-oversight` (BE PR #148). READ: danh sách task hiện MỌI task
 * của kho mình (thiếu quyền → chỉ task được gán cho mình) và xem được task dù không phải người được gán.
 * Seed: ORDER_COORDINATOR, WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 */
export const FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS = {
  read: "fulfillment-task-oversight:READ",
} as const;

/**
 * Lấy hàng — resource `fulfillment-picking` (BE PR #148). UPDATE: bắt đầu / hoàn tất lấy hàng, xác nhận
 * dòng, trả hàng về vị trí. READ: `GET /fulfillment/put-backs`. Seed: WAREHOUSE_STAFF,
 * WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 */
export const FULFILLMENT_PICKING_PERMISSIONS = {
  read: "fulfillment-picking:READ",
  update: "fulfillment-picking:UPDATE",
} as const;

/**
 * Hàng chờ / phiên đóng gói và tải artifact thiết kế — resource `fulfillment-packages`
 * (BE FulfillmentResources.PACKAGES). READ: `GET /packing-queue`, `GET /tasks/{id}/packing-session`,
 * tải artifact. `fulfillment-packages:CREATE` không còn bảo vệ endpoint nào (BE PR #148): thao tác đóng
 * gói là `fulfillment-packing:UPDATE`, kiểm tra lại thiết kế là `fulfillment-design-reverification:UPDATE`.
 */
export const FULFILLMENT_PACKAGE_PERMISSIONS = {
  viewPage: "fulfillment-packages:VIEW_PAGE",
  read: "fulfillment-packages:READ",
} as const;

/**
 * Thao tác đóng gói — resource `fulfillment-packing` (BE PR #148). UPDATE: nhận đơn, tạo / quét / niêm
 * phong / mở lại / huỷ kiện, hoàn tất đóng gói (và người đóng gói xem được task đã lấy xong). READ: nhãn
 * kiện. APPROVE: làm hộ / tiếp quản phiên của người đóng khác. Seed: UPDATE + READ cho WAREHOUSE_STAFF,
 * WAREHOUSE_MANAGER; APPROVE chỉ WAREHOUSE_MANAGER; SYSTEM_ADMIN đủ.
 */
export const FULFILLMENT_PACKING_PERMISSIONS = {
  read: "fulfillment-packing:READ",
  update: "fulfillment-packing:UPDATE",
  approve: "fulfillment-packing:APPROVE",
} as const;

/**
 * Kiểm tra lại thiết kế — resource `fulfillment-design-reverification` (BE PR #148). UPDATE:
 * `POST /tasks/{id}/design-integrity-reverification`. READ: task đang giữ do lệch thiết kế hiện cho
 * người này (không cần là người được gán) và tải được file thiết kế. Seed: QC_STAFF,
 * WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 */
export const FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS = {
  read: "fulfillment-design-reverification:READ",
  update: "fulfillment-design-reverification:UPDATE",
} as const;

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
 * Xem lô giao / chuyến xe / hãng — resource `fulfillment-shipments` (BE `ShipmentController`,
 * `DispatchController`, `CarrierController` đọc). Ghi đã tách sang các resource bên dưới (BE PR #148):
 * `fulfillment-shipments:CREATE/UPDATE` không còn bảo vệ endpoint nào.
 */
export const SHIPMENT_PERMISSIONS = {
  viewPage: "fulfillment-shipments:VIEW_PAGE",
  read: "fulfillment-shipments:READ",
} as const;

/**
 * Xếp xe & bàn giao — resource `fulfillment-dispatch` (BE PR #148). CREATE: mở chuyến
 * (`POST /fulfillment/loads`). UPDATE: thêm / bớt lô, quét / gỡ quét kiện, bàn giao, chọn hãng cho lô
 * (`PUT /shipments/{id}/carrier`). Seed: WAREHOUSE_STAFF, WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 */
export const FULFILLMENT_DISPATCH_PERMISSIONS = {
  create: "fulfillment-dispatch:CREATE",
  update: "fulfillment-dispatch:UPDATE",
} as const;

/** Huỷ chuyến xe trước khi rời kho (`POST /loads/{id}/cancellation`) — seed: WAREHOUSE_MANAGER, SYSTEM_ADMIN. */
export const FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS = {
  update: "fulfillment-load-cancellations:UPDATE",
} as const;

/** Danh mục hãng vận chuyển: thêm / sửa (`POST`, `PUT /fulfillment/carriers`) — seed: WAREHOUSE_MANAGER, SYSTEM_ADMIN. */
export const FULFILLMENT_CARRIER_PERMISSIONS = {
  update: "fulfillment-carriers:UPDATE",
} as const;

/**
 * Kết quả giao — resource `fulfillment-delivery-outcomes` (BE PR #148, docs 09 BR-02).
 * UPDATE một mình = chỉ ghi HÀNG HOÀN VỀ KHO (RETURNED); ĐÃ GIAO / GIAO THẤT BẠI cần thêm APPROVE
 * (kéo theo đơn và công nợ). Seed: UPDATE cho ORDER_COORDINATOR, WAREHOUSE_MANAGER; APPROVE cho
 * ORDER_COORDINATOR; SYSTEM_ADMIN đủ.
 */
export const FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS = {
  update: "fulfillment-delivery-outcomes:UPDATE",
  approve: "fulfillment-delivery-outcomes:APPROVE",
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
  /** Tạo vai trò tuỳ chỉnh — `POST /identity/roles` (BE PR #72, SCRUM-455). */
  rolesCreate: "identity-roles:CREATE",
  /** Đổi tên / mô tả / phạm vi dữ liệu của vai trò tuỳ chỉnh — `PATCH /identity/roles/{code}`. */
  rolesUpdate: "identity-roles:UPDATE",
  /** Xoá vai trò tuỳ chỉnh không còn ai giữ — `DELETE /identity/roles/{code}` (chỉ SYSTEM_ADMIN trong seed). */
  rolesDelete: "identity-roles:DELETE",
  rbacRead: "identity-rbac:READ",
  rbacApprove: "identity-rbac:APPROVE",
  /**
   * Tài khoản nhân viên — BE `UserManagementController` (PR #72, SCRUM-454): danh sách / chi tiết = READ,
   * tạo = CREATE; sửa hồ sơ, gán vai trò / kho, khoá, vô hiệu hoá, đặt lại mật khẩu đều là UPDATE.
   */
  usersRead: "identity-users:READ",
  usersCreate: "identity-users:CREATE",
  usersUpdate: "identity-users:UPDATE",
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

/**
 * Báo cáo bán hàng (SCRUM-345) — resource `reporting-reports` (BE `ReportController`,
 * `/api/v1/reports`). READ: doanh số theo ngày, top SKU, đơn theo trạng thái, tổng hợp; EXPORT:
 * tính lại số liệu (`POST /reports/rebuild`, chỉ quản trị). Truy cập theo READ (quyết định DASH-KPI).
 */
export const REPORTING_PERMISSIONS = {
  viewPage: "reporting-reports:VIEW_PAGE",
  read: "reporting-reports:READ",
  export: "reporting-reports:EXPORT",
} as const;
