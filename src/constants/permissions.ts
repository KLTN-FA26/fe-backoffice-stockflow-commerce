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

/**
 * Khách hàng B2B — resource `customer-customers` (BE CustomerController + CustomerOnboardingController,
 * SCRUM-450). CREATE = Sales tạo khách + gửi / gửi lại lời mời portal (seed V20261015000100: SALES_STAFF,
 * ECOMMERCE_ADMIN, SYSTEM_ADMIN). APPROVE = đổi trạng thái (khoá / mở lại, lý do bắt buộc).
 * Endpoint chỉ có ở BE local integration d215f6e — chưa merge develop.
 */
export const CUSTOMER_PERMISSIONS = {
  viewPage: "customer-customers:VIEW_PAGE",
  read: "customer-customers:READ",
  create: "customer-customers:CREATE",
  update: "customer-customers:UPDATE",
  approve: "customer-customers:APPROVE",
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
 * Báo giá B2B — resource `sales-quotes` (BE QuoteController, SCRUM-448, seed V20261015000300).
 * SALES_STAFF V/R/C/U · ORDER_COORDINATOR V/R/U · CUSTOMER V/R/APPROVE (chấp nhận / yêu cầu sửa).
 */
export const QUOTE_PERMISSIONS = {
  viewPage: "sales-quotes:VIEW_PAGE",
  read: "sales-quotes:READ",
  create: "sales-quotes:CREATE",
  // Sửa nháp, gửi, mở bản sửa, huỷ, chuyển thành đơn
  update: "sales-quotes:UPDATE",
  // Phía khách: chấp nhận / yêu cầu sửa
  approve: "sales-quotes:APPROVE",
} as const;

/**
 * Yêu cầu làm mẫu — resource `production-sample-requests` (BE SampleRequestController, SCRUM-403;
 * seed V20261010000500 + V20261015000200: CUSTOMER V/R/APPROVE, SALES_STAFF có APPROVE).
 */
export const SAMPLE_REQUEST_PERMISSIONS = {
  viewPage: "production-sample-requests:VIEW_PAGE",
  read: "production-sample-requests:READ",
  create: "production-sample-requests:CREATE",
  update: "production-sample-requests:UPDATE",
  approve: "production-sample-requests:APPROVE",
} as const;

/**
 * Lệnh sản xuất (LSX) — resource `production-orders` (BE ProductionOrderController, SCRUM-405..415).
 * UPDATE = prepress, treo, in, ghi sản lượng · APPROVE = huỷ / dừng / tiếp tục, tách gia công.
 */
export const PRODUCTION_ORDER_PERMISSIONS = {
  viewPage: "production-orders:VIEW_PAGE",
  read: "production-orders:READ",
  update: "production-orders:UPDATE",
  approve: "production-orders:APPROVE",
} as const;

/** Bảng giá theo khách — `catalog-customer-prices` (BE d215f6e, P7): Sales chỉ đọc. */
export const CATALOG_CUSTOMER_PRICE_PERMISSIONS = {
  read: "catalog-customer-prices:READ",
} as const;

/** Kho & sơ đồ vị trí — `warehouse-warehouses`, `warehouse-locations` (BE WarehouseController). */
export const WAREHOUSE_PERMISSIONS = {
  read: "warehouse-warehouses:READ",
  locationsRead: "warehouse-locations:READ",
} as const;

/**
 * Thiết kế đã khách xác nhận — `design-snapshots` (BE PR #109 `DesignSnapshotController`, cấp cho SALES_STAFF ở
 * V20261015000800). Chỉ back-office; BE từ chối khách hàng dù khách cũng có mã quyền này.
 */
export const DESIGN_SNAPSHOT_PERMISSIONS = {
  read: "design-snapshots:READ",
} as const;

/** Xuất phôi cho LSX + gửi / nhận gia công — `production-material-issues` (seed V20261015000400). */
export const MATERIAL_ISSUE_PERMISSIONS = {
  read: "production-material-issues:READ",
  create: "production-material-issues:CREATE",
} as const;

/** QC thành phẩm LSX — `production-qc-results` (seed V20261015000420: QC_STAFF, WAREHOUSE_MANAGER). */
export const PRODUCTION_QC_PERMISSIONS = {
  read: "production-qc-results:READ",
  create: "production-qc-results:CREATE",
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
  ECOMMERCE_ADMIN: "ECOMMERCE_ADMIN",
  SALES_STAFF: "SALES_STAFF",
  /** Tài khoản portal của khách B2B — chỉ thấy `/portal`, không thấy back-office. */
  CUSTOMER: "CUSTOMER",
} as const;

export type StaffRole = (typeof STAFF_ROLE)[keyof typeof STAFF_ROLE];

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
