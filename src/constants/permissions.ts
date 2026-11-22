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
 * Đơn hàng — resource `sales-orders` (BE `OrderResources.ORDERS`).
 * - `release`: release đơn sang kho xuất (`POST /orders/{id}/release`, BR-03 docs 17) — resource riêng
 *   `sales-order-releases` (UPDATE, scope ALL, BE V20261115000200): quản lý kho của kho xuất; BE kiểm thêm kho
 *   người gọi phụ trách (`WarehouseScope`). `sales-orders:APPROVE` đã bị BE xoá khỏi mọi vai trò (tách thành
 *   `sales-order-releases`, `sales-order-holds`, `fulfillment-delivery-outcomes:APPROVE`).
 * - `hold`: giữ đơn (`POST /orders/{id}/hold`) và gỡ giữ (`POST /orders/{id}/hold/resolution`) — resource riêng
 *   `sales-order-holds` (UPDATE, scope ALL; seed: SALES_STAFF + SYSTEM_ADMIN, docs 17 §4.9). Ghi giao thất bại ở cấp
 *   đơn là `FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS.approve`, không còn ở đây.
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
  create: "sales-orders:CREATE",
  // Giữ / gỡ giữ — OrderReleaseController (`sales-order-holds:UPDATE`, scope ALL, Sales); mã `sales-orders:APPROVE` BE đã xoá
  hold: "sales-order-holds:UPDATE",
  // Release đơn sang kho xuất — OrderReleaseController (`sales-order-releases:UPDATE`, scope ALL, WM của kho xuất)
  release: "sales-order-releases:UPDATE",
  // Huỷ đơn phía admin + đóng phần còn lại — resource riêng `sales-order-cancellations`
  // (BE V20261013000200): SALES_STAFF + ORDER_COORDINATOR có UPDATE.
  cancel: "sales-order-cancellations:UPDATE",
  // Cho phép / dừng giao một phần của đơn (`PUT /orders/{id}/partial-shipment`, BE PR #150) — resource
  // `sales-order-partial-shipments` (UPDATE, scope ALL; seed: SALES_STAFF + SYSTEM_ADMIN)
  partialShipment: "sales-order-partial-shipments:UPDATE",
  // Đổi địa chỉ giao của đơn tới khi thùng đầu tiên được dán nhãn (`PUT /orders/{id}/shipping-address`, docs 17 §4.7
  // bước 23-24, BR-16; 08 BR-04) — resource riêng `sales-order-addresses` (UPDATE, scope ALL; seed: SALES_STAFF + SYSTEM_ADMIN)
  shippingAddress: "sales-order-addresses:UPDATE",
} as const;

/**
 * Kho xuất của đơn — resource `sales-order-shipping-warehouses` (BE `ShippingWarehouseController`). FE chỉ ĐỌC kho Sale
 * đã chọn (`GET /orders/{id}/shipping-warehouse/options` → `chosenWarehouseId`) để chọn sẵn ở hộp thoại release. Seed BE
 * (PermissionMatrixTest): READ của SALES_STAFF, SALES_MANAGER, WAREHOUSE_MANAGER, PRODUCTION_COORDINATOR, SYSTEM_ADMIN.
 */
export const ORDER_SHIPPING_WAREHOUSE_PERMISSIONS = {
  read: "sales-order-shipping-warehouses:READ",
} as const;

/**
 * Lịch giao của đơn — resource `sales-order-delivery-batches` (BE `OrderResources.DELIVERY_BATCHES`, PR #317, WF4 BE-13,
 * seed V20261124000650): `read` cho `GET /orders/{id}/delivery-batches` — ô chọn đợt giao khi release và panel lịch giao.
 * Mọi vai đọc được hợp đồng trước đây (`sales-contracts:READ`) và mọi vai release (`sales-order-releases:UPDATE`, quản lý
 * kho) — quản lý kho đọc lịch giao mà không phải đọc hợp đồng. Người giới hạn theo kho chỉ thấy lịch của đơn xuất từ / release
 * cho kho của mình (BE trả 404 cho đơn ngoài tầm). Dời cửa sổ giao vẫn là `sales-contracts:UPDATE` (bên dưới).
 */
export const ORDER_DELIVERY_BATCH_PERMISSIONS = {
  read: "sales-order-delivery-batches:READ",
} as const;

/**
 * Chat Sale ↔ khách — resource `chat-conversations` (BE StaffChatController, seed V20261124000300: SALES_STAFF,
 * SALES_MANAGER, SYSTEM_ADMIN đủ VIEW_PAGE / READ / CREATE / UPDATE). Giám sát (`chat-supervision`) chỉ quản lý.
 */
export const CHAT_PERMISSIONS = {
  viewPage: "chat-conversations:VIEW_PAGE",
  read: "chat-conversations:READ",
  create: "chat-conversations:CREATE",
  update: "chat-conversations:UPDATE",
  /** Người giám sát chat (16 §2): phân công hội thoại chưa ai nhận, xử lý hội thoại đã chuyển cấp. */
  supervise: "chat-supervision:UPDATE",
  /** Câu trả lời mẫu (S23, S24; seed: SALES_STAFF, SALES_MANAGER, SYSTEM_ADMIN). */
  cannedRead: "chat-canned-responses:READ",
} as const;

/**
 * Hợp đồng bán — resource `sales-contracts` (BE `OrderResources.SALES_CONTRACTS`). Chỉ khai báo mã FE đang dùng:
 * - `read`: không còn dùng cho lịch giao (đã chuyển sang `sales-order-delivery-batches:READ`, bên trên); giữ lại cho fixture
 *   / mock mô tả vai đọc hợp đồng. Seed BE: SALES_STAFF, SALES_MANAGER, ACCOUNTANT, PRODUCTION_COORDINATOR, SYSTEM_ADMIN.
 * - `update`: Sale dời cửa sổ giao (`POST /orders/{id}/delivery-batches/{batchId}/window-change`, docs 17 BR-28 "chỉ
 *   Sale"). Seed BE: SALES_STAFF + SYSTEM_ADMIN (PermissionMatrixTest).
 */
export const SALES_CONTRACT_PERMISSIONS = {
  read: "sales-contracts:READ",
  // WF-02 pha B: lập hợp đồng nháp (`POST /orders/{id}/contract`)
  create: "sales-contracts:CREATE",
  // Sửa nháp, gửi, huỷ hợp đồng; dời cửa sổ giao
  update: "sales-contracts:UPDATE",
  // Ghi nhận đã ký (`POST /orders/{id}/contract/signature`)
  approve: "sales-contracts:APPROVE",
} as const;

/**
 * Hàng đợi yêu cầu huỷ của khách (`GET /orders/cancellation-requests`) — resource `sales-order-cancellations`, action
 * READ (BE V20261022000200, tách khỏi `sales-orders:READ` để Kế toán đọc đơn không mở luôn hàng đợi). Seed BE:
 * SALES_STAFF + SYSTEM_ADMIN. Duyệt / từ chối là `ORDER_PERMISSIONS.cancel` (cùng resource, UPDATE). Resource này không
 * có VIEW_PAGE (BE `OrderCancellationsResourceDeclaration`: chỉ READ, UPDATE) nên trang gate bằng READ.
 */
export const CANCELLATION_REQUEST_PERMISSIONS = {
  read: "sales-order-cancellations:READ",
} as const;

/**
 * Hoàn tiền của đơn — resource `payment-refunds` (BE `RefundController`). FE đơn hàng chỉ ĐỌC kết quả tất toán sau huỷ; màn Kế toán (`@/constants/payment`) dùng thêm VIEW_PAGE / CREATE / UPDATE
 * (`GET /refunds/orders/{orderId}`): seed BE cấp READ cho ACCOUNTANT, SALES_STAFF, SALES_MANAGER, SYSTEM_ADMIN (và
 * khách, scope OWN). Ghi nhận / huỷ phiếu hoàn là việc của Kế toán ở màn thanh toán, không thuộc màn đơn.
 */
export const PAYMENT_REFUND_PERMISSIONS = {
  viewPage: "payment-refunds:VIEW_PAGE",
  read: "payment-refunds:READ",
  create: "payment-refunds:CREATE",
  update: "payment-refunds:UPDATE",
} as const;

/**
 * Đơn công nợ vượt hạn mức — resource `sales-order-credit-holds` (BE CreditHoldController,
 * SCRUM-427, seed V20261013000400): ACCOUNTANT có VIEW_PAGE/READ/APPROVE; SALES_STAFF và
 * ORDER_COORDINATOR chỉ VIEW_PAGE/READ (xem, không duyệt).
 */
export const CREDIT_HOLD_PERMISSIONS = {
  viewPage: "sales-order-credit-holds:VIEW_PAGE",
  read: "sales-order-credit-holds:READ",
  // Duyệt (`/credit-approval`) và từ chối (`/credit-rejection`) đều là APPROVE
  approve: "sales-order-credit-holds:APPROVE",
} as const;

/**
 * Hồ sơ công nợ khách — resource `customer-credit-profiles` (BE seed V20261013000400): ACCOUNTANT
 * VIEW_PAGE/READ/APPROVE, SALES_STAFF VIEW_PAGE/READ, ORDER_COORDINATOR READ. FE chỉ dùng READ —
 * `GET /orders/credit-position/{customerId}` (CreditHoldController#position) đòi đúng quyền này.
 */
export const CUSTOMER_CREDIT_PROFILE_PERMISSIONS = {
  read: "customer-credit-profiles:READ",
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
 * Thùng có LPN — resource `inventory-stock-packages` (BE StockPackageController, SCRUM-473; seed
 * V20261020000700). CREATE = in / in lại nhãn thùng: NV kho + Quản lý kho; Planner và NV QC chỉ READ.
 */
export const STOCK_PACKAGE_PERMISSIONS = {
  viewPage: "inventory-stock-packages:VIEW_PAGE",
  read: "inventory-stock-packages:READ",
  create: "inventory-stock-packages:CREATE",
  update: "inventory-stock-packages:UPDATE",
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
 * Cấu hình in của biến thể (mẫu tuỳ biến) — resource `product-customization-templates` (BE
 * `CustomizationTemplateController`, `ProductResources.CUSTOMIZATION_TEMPLATES`; seed baseline
 * V20261111000000). READ: xem danh sách, chi tiết và link tải file model; CREATE: tạo mẫu (`POST`);
 * UPDATE: sửa mẫu, gửi file model / file tham chiếu, kích hoạt và ngừng dùng. Quản lý bán hàng và System
 * Admin giữ resource này; nhân viên bán hàng không (chủ dự án xác nhận) dù có quyền đọc sản phẩm.
 */
export const CUSTOMIZATION_TEMPLATE_PERMISSIONS = {
  viewPage: "product-customization-templates:VIEW_PAGE",
  read: "product-customization-templates:READ",
  create: "product-customization-templates:CREATE",
  update: "product-customization-templates:UPDATE",
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
  // Mở trang (menu + chặn route) — BE Action.VIEW_PAGE, ADR-0004. Tách khỏi READ (dữ liệu):
  // không quyền nào bao hàm quyền kia, nên trang cần cả hai.
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
  // GET /inventory/stock-items?sku= (tồn theo SKU và vị trí) — gợi ý nguồn khi chuyển vị trí
  stockRead: "inventory-stock-items:READ",
} as const;

/**
 * Phiếu kiểm kê — resource `inventory-cycle-counts` (BE `CycleCountController`, seed V20260903000100,
 * V20261023000300, V20261028001000). READ / UPDATE: người đếm (NV kho) xem và đếm phiếu; CREATE: lập / giao
 * phiếu; APPROVE: thấy số sổ sách, yêu cầu đếm lại, huỷ phiếu (Quản lý kho). Docs 20 BR-07: ai có APPROVE
 * mới thấy sổ sách của phiếu kiểm mù.
 */
export const CYCLE_COUNT_PERMISSIONS = {
  viewPage: "inventory-cycle-counts:VIEW_PAGE",
  read: "inventory-cycle-counts:READ",
  create: "inventory-cycle-counts:CREATE",
  update: "inventory-cycle-counts:UPDATE",
  approve: "inventory-cycle-counts:APPROVE",
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
 * Bảng giá riêng của khách hàng — resource `catalog-customer-prices` (BE `CustomerPriceController`,
 * `/api/v1/catalog/customer-prices`). Seed BE (baseline V20261111000000): SALES_MANAGER và SYSTEM_ADMIN đủ quyền
 * (kể cả DELETE); SALES_STAFF VIEW_PAGE / READ.
 */
export const CUSTOMER_PRICE_PERMISSIONS = {
  viewPage: "catalog-customer-prices:VIEW_PAGE",
  // GET /catalog/customer-prices?customerId=, GET …/{customerId}/{sku}
  read: "catalog-customer-prices:READ",
  // POST …/{customerId}/{sku}
  create: "catalog-customer-prices:CREATE",
  // PUT …/{customerId}/{sku} (thay toàn bộ, cần version)
  update: "catalog-customer-prices:UPDATE",
  // DELETE …/{customerId}/{sku}?version= (13 §4.2 bước 5)
  delete: "catalog-customer-prices:DELETE",
} as const;

/**
 * Sơ đồ kho — resource `warehouse-locations` (BE `LayoutController`): `GET /warehouses/{id}/layout`
 * và `GET /locations/{code}`. WAREHOUSE_STAFF có VIEW_PAGE/READ (seed V20260928006000).
 */
export const WAREHOUSE_LOCATION_PERMISSIONS = {
  // Trang bản đồ kho `/admin/warehouse-map` (`WarehouseLocationResourceDeclaration.route`)
  viewPage: "warehouse-locations:VIEW_PAGE",
  read: "warehouse-locations:READ",
  // Thêm zone / kệ / tầng / bin / khu vực / tường-cửa — chỉ Quản lý kho, System Admin (docs 06 §2)
  create: "warehouse-locations:CREATE",
  // Sửa và đổi trạng thái kệ / bin / khu vực, mở-đóng cửa
  update: "warehouse-locations:UPDATE",
  // Chỉ tường / cửa xoá hẳn được; kệ, bin, khu vực, zone không xoá (BR-04)
  delete: "warehouse-locations:DELETE",
} as const;

/**
 * Tổng quan tồn kho (SCRUM-438) — resource `InventoryResources.STOCK_ITEMS` / `RESERVATIONS`. Tồn kho và giữ chỗ là hai resource riêng; seed BE V20260903000100.
 */
export const INVENTORY_OVERVIEW_PERMISSIONS = {
  stockViewPage: "inventory-stock-items:VIEW_PAGE",
  stockRead: "inventory-stock-items:READ",
  reservationViewPage: "inventory-reservations:VIEW_PAGE",
  reservationRead: "inventory-reservations:READ",
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
 * gói là `fulfillment-packing:UPDATE`. BE đã bỏ bước kiểm tra thiết kế lúc đóng gói.
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
 * Khách hàng B2B — resource `customer-customers` (BE CustomerController + CustomerOnboardingController,
 * SCRUM-450). CREATE = Sales tạo khách + gửi / gửi lại lời mời portal (seed V20261017000100: SALES_STAFF,
 * ECOMMERCE_ADMIN, SYSTEM_ADMIN). Đổi trạng thái dùng resource `customer-status` riêng;
 * Sales có quyền duyệt khách nhưng không được khoá / mở lại tài khoản.
 */
export const CUSTOMER_PERMISSIONS = {
  viewPage: "customer-customers:VIEW_PAGE",
  read: "customer-customers:READ",
  create: "customer-customers:CREATE",
  update: "customer-customers:UPDATE",
  approve: "customer-status:APPROVE",
} as const;

/** Sổ địa chỉ của khách — resource `customer-addresses` (BE CustomerAddressController `GET /customers/{id}/addresses`). */
export const CUSTOMER_ADDRESS_PERMISSIONS = {
  read: "customer-addresses:READ",
} as const;

/**
 * Điều khoản thanh toán của khách — resource `customer-credit-profiles` (BE CreditProfileController).
 * APPROVE = người duyệt công nợ hiện có (BR-02). Quyết định B1 (2026-10-13): Sales chỉ chọn
 * PREPAID / DEPOSIT lúc tạo khách, KHÔNG có quyền cấp CREDIT.
 */
export const CREDIT_PROFILE_PERMISSIONS = {
  read: "customer-credit-profiles:READ",
  approve: "customer-credit-profiles:APPROVE",
} as const;

/**
 * Báo giá B2B — resource `sales-quotes` (BE QuoteController, SCRUM-448).
 * Chuyển báo giá đã chấp nhận thành đơn dùng `sales-quote-conversions:CREATE` riêng,
 * để điều phối đơn được chuyển mà không có quyền sửa nội dung báo giá.
 */
export const QUOTE_PERMISSIONS = {
  viewPage: "sales-quotes:VIEW_PAGE",
  read: "sales-quotes:READ",
  create: "sales-quotes:CREATE",
  // Sửa nháp, gửi, mở bản sửa, huỷ
  update: "sales-quotes:UPDATE",
  convert: "sales-quote-conversions:CREATE",
  // Phía khách: chấp nhận / yêu cầu sửa
  approve: "sales-quotes:APPROVE",
} as const;

/**
 * Đơn sản xuất — resource `production-orders` (BE `OrderResources.PRODUCTION_ORDERS`, PermissionMatrixTest; docs 17
 * §4.3, BR-23). CREATE / UPDATE: Điều phối sản xuất (lập, sửa nháp, gửi duyệt, ghi nhận nhận đơn, ngày dự kiến, bắt đầu
 * sản xuất, huỷ, đóng, gửi lại mail, vòng mẫu in). APPROVE: Sales Manager (duyệt = gửi, trả lại). READ: thêm Sale và Quản
 * lý kho (BE lọc theo kho).
 */
export const PRODUCTION_ORDER_PERMISSIONS = {
  viewPage: "production-orders:VIEW_PAGE",
  read: "production-orders:READ",
  create: "production-orders:CREATE",
  update: "production-orders:UPDATE",
  approve: "production-orders:APPROVE",
} as const;

/**
 * Danh mục đơn vị sản xuất — resource `sales-producers` (BE `OrderResources.PRODUCERS`, docs 17 §4.3, chốt 2026-11-07):
 * Điều phối sản xuất thêm / sửa; Sales Manager, Sale, Quản lý kho chỉ đọc.
 */
export const PRODUCER_PERMISSIONS = {
  viewPage: "sales-producers:VIEW_PAGE",
  read: "sales-producers:READ",
  create: "sales-producers:CREATE",
  update: "sales-producers:UPDATE",
} as const;

/** Lịch sản xuất — resource `production-schedule` (docs 17 §4.12 bước 47): Điều phối SX, Sale, QLKD, Quản lý kho. */
export const PRODUCTION_SCHEDULE_PERMISSIONS = {
  viewPage: "production-schedule:VIEW_PAGE",
  read: "production-schedule:READ",
} as const;

/**
 * Cờ trễ trên trang đơn — resource `delay-alerts` (docs 17 §4.12 bước 49): Sale, Sales Manager, Quản lý kho. Điều phối
 * sản xuất không có — họ xem cờ trên lịch sản xuất.
 */
export const DELAY_ALERT_PERMISSIONS = {
  read: "delay-alerts:READ",
} as const;

/** Bảng giá theo khách — `catalog-customer-prices` (BE d215f6e, P7): Sales chỉ đọc. */
export const CATALOG_CUSTOMER_PRICE_PERMISSIONS = {
  read: "catalog-customer-prices:READ",
} as const;

/**
 * Thiết kế đã khách xác nhận — `design-snapshots` (BE PR #109 `DesignSnapshotController`, cấp cho SALES_STAFF ở
 * V20261017000800). Chỉ back-office; BE từ chối khách hàng dù khách cũng có mã quyền này.
 */
export const DESIGN_SNAPSHOT_PERMISSIONS = {
  read: "design-snapshots:READ",
} as const;

/**
 * Thiết kế của khách — `design-designs` (BE `DesignReviewController`, `DesignWorkflowController`; seed
 * V20261111000000, V20261213000200). VIEW_PAGE / READ có cả SALES_STAFF, SALES_MANAGER; APPROVE (hàng đợi duyệt, duyệt /
 * trả lại) chỉ PRODUCTION_COORDINATOR và SYSTEM_ADMIN — menu duyệt gate bằng `approve`, không bằng `viewPage`.
 */
export const DESIGN_PERMISSIONS = {
  viewPage: "design-designs:VIEW_PAGE",
  read: "design-designs:READ",
  approve: "design-designs:APPROVE",
} as const;

/** Yêu cầu báo giá trên thiết kế — `design-quote-requests` (BE `DesignQuoteRequestController`; SALES_STAFF, SALES_MANAGER). */
export const DESIGN_QUOTE_REQUEST_PERMISSIONS = {
  viewPage: "design-quote-requests:VIEW_PAGE",
  read: "design-quote-requests:READ",
  update: "design-quote-requests:UPDATE",
} as const;

/**
 * Mã vai trò tài khoản cửa hàng (storefront) — BE `Role.CUSTOMER`. CHỈ dùng ở cổng back-office
 * (`lib/auth/back-office.ts`, gương BE `ScopeGuards` / `CurrentUser#isPortalCustomer`) để tách phạm vi dữ liệu
 * khách hàng khỏi back-office. Không phải mã quyền: quyền thao tác luôn theo mã quyền ở file này.
 */
export const PORTAL_CUSTOMER_ROLE = "CUSTOMER";

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
 * Xếp xe & bàn giao — resource `fulfillment-dispatch` (BE `DispatchController`, chỉ có UPDATE): ghi nhận đặt xe, huỷ đặt xe,
 * bắt đầu xếp, quét / gỡ quét kiện, dỡ kiện, nhập mã vận đơn trước khi rời kho, bàn giao. Seed: WAREHOUSE_STAFF,
 * WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 */
export const FULFILLMENT_DISPATCH_PERMISSIONS = {
  update: "fulfillment-dispatch:UPDATE",
} as const;

/**
 * Huỷ có kiểm soát sau khi đã bắt đầu xếp hàng (SCRUM-474 UNLOAD-DESIGN, docs 09 BR-14) — resource
 * `fulfillment-controlled-cancellations`, một mã quyền cho cả ba việc của quản lý kho: huỷ có kiểm soát cả kế hoạch
 * (`POST /load-plans/{id}/controlled-cancellation`), huỷ có kiểm soát MỘT xe (`POST /loads/{id}/controlled-cancellation`)
 * và xác nhận dỡ kiện không cần quét khi nhãn hỏng (`POST /loads/{id}/unload-overrides`).
 * Seed V20261029007100: WAREHOUSE_MANAGER, SYSTEM_ADMIN. Quét dỡ kiện vẫn là `fulfillment-dispatch:UPDATE`.
 */
export const FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS = {
  update: "fulfillment-controlled-cancellations:UPDATE",
} as const;

/**
 * Sửa mã vận đơn SAU KHI chuyến rời kho (`PUT /fulfillment/loads/{id}/waybill` khi chuyến DISPATCHED) — BR-24 docs 09:
 * chỉ quản lý kho, bắt buộc lý do. BE V20261108001400 seed: WAREHOUSE_MANAGER, SYSTEM_ADMIN. Nhập mã vận đơn TRƯỚC
 * khi rời kho chỉ cần `fulfillment-dispatch:UPDATE`.
 */
export const FULFILLMENT_WAYBILL_CORRECTION_PERMISSIONS = {
  update: "fulfillment-waybill-corrections:UPDATE",
} as const;

/**
 * Nhập mã vận đơn hàng loạt từ file (BE `WaybillImportController`, docs 09 §4.4, BR-25): READ = tải file mẫu + xem
 * các lần nhập; CREATE = xem trước + nhập file. BE V20261108001500 seed: WAREHOUSE_STAFF, WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 */
export const FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS = {
  read: "fulfillment-waybill-imports:READ",
  create: "fulfillment-waybill-imports:CREATE",
} as const;

/**
 * Danh mục hãng vận chuyển: thêm / sửa (`POST`, `PUT /fulfillment/carriers`) — seed: WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 * Xem danh sách hãng là `fulfillment-shipments:READ` (resource này chỉ có UPDATE, không VIEW_PAGE / READ).
 */
export const FULFILLMENT_CARRIER_PERMISSIONS = {
  update: "fulfillment-carriers:UPDATE",
} as const;

/**
 * Sự kiện hãng vận chuyển (BE `CarrierEventController`, docs 09 §4.5 bước 2, 8): READ = xem nhật ký sự kiện webhook và
 * danh sách lỗi; UPDATE = đánh dấu một sự kiện lỗi đã xử lý (kèm ghi chú). BE chưa có thao tác áp lại sự kiện.
 */
export const FULFILLMENT_CARRIER_EVENT_PERMISSIONS = {
  read: "fulfillment-carrier-events:READ",
  update: "fulfillment-carrier-events:UPDATE",
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
 * Sửa tay kết quả giao khi hãng báo sai — `POST /fulfillment/shipments/{id}/delivery-outcome-correction` (docs 09 §4.3
 * bước 5, E17). BE seed: WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 */
export const FULFILLMENT_DELIVERY_CORRECTION_PERMISSIONS = {
  update: "fulfillment-delivery-corrections:UPDATE",
} as const;

/**
 * Danh mục kho — resource `warehouse-warehouses` (BE WarehouseController: GET /warehouses = READ).
 * Seed V20260928006000: WAREHOUSE_MANAGER, WAREHOUSE_STAFF, INVENTORY_PLANNER, PROCUREMENT_STAFF;
 * V20261017000800 thêm SALES_STAFF; QC_STAFF không có.
 */
/**
 * Bảng sức chứa kho — resource `warehouse-capacity` (BE `OrderResources.WAREHOUSE_CAPACITY`, seed
 * V20261125000100): Quản lý kho (chỉ kho được gán — BE tự thu hẹp), Sale, Điều phối sản xuất, Quản lý kinh doanh
 * (docs 06 §2). Sửa hệ số sử dụng đi qua `PUT /warehouses/{id}` nên cần `warehouse-warehouses:UPDATE`.
 */
export const WAREHOUSE_CAPACITY_PERMISSIONS = {
  viewPage: "warehouse-capacity:VIEW_PAGE",
  read: "warehouse-capacity:READ",
  warehouseRead: "warehouse-warehouses:READ",
  warehouseUpdate: "warehouse-warehouses:UPDATE",
} as const;

export const WAREHOUSE_PERMISSIONS = {
  // Trang danh mục kho `/admin/warehouses` (`WarehouseController` @PermissionResource route)
  viewPage: "warehouse-warehouses:VIEW_PAGE",
  read: "warehouse-warehouses:READ",
  locationsRead: "warehouse-locations:READ",
  // Khai báo kho mới — `POST /warehouses` (Quản lý kho / System Admin, docs 06 §2)
  create: "warehouse-warehouses:CREATE",
  update: "warehouse-warehouses:UPDATE",
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
  backOfficeDeniedTitle: "Tài khoản không dùng được trang quản trị",
  backOfficeDeniedDescription:
    "Trang quản trị chỉ dành cho nhân viên. Tài khoản khách hàng không vào được khu vực này.",
  logout: "Đăng xuất",
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

/**
 * Sửa lý do giao thất bại khi đã biết lý do thật — `POST /fulfillment/shipments/{id}/failure-reason-correction` (docs 09
 * edge "hoàn hàng khi còn Handed Over"). Cùng mã quyền sửa tay kết quả giao. BE seed: WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 */
export const SHIPMENT_FAILURE_REASON_PERMISSIONS = {
  correct: "fulfillment-delivery-corrections:UPDATE",
} as const;

/**
 * File vận đơn và POD của một đơn — `GET /fulfillment/orders/{id}/delivery-documents` (docs 09 §2: Sale gửi khách khi
 * khách xin qua chat). BE seed: SALES_STAFF, SALES_MANAGER, SYSTEM_ADMIN; khách không có (BR-05).
 */
export const ORDER_DELIVERY_DOCUMENT_PERMISSIONS = {
  read: "fulfillment-delivery-documents:READ",
} as const;

/**
 * Huỷ lô giao Sẵn sàng xuất — `POST /fulfillment/shipments/{id}/cancellation` (docs 09 §5.1, RTM-RTDCANCEL). BE seed:
 * WAREHOUSE_MANAGER, SYSTEM_ADMIN.
 */
export const SHIPMENT_CANCELLATION_PERMISSIONS = {
  update: "fulfillment-shipment-cancellations:UPDATE",
} as const;
