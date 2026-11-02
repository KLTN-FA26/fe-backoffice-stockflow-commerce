const ADMIN_BASE = "/admin";
const PORTAL_BASE = "/portal";

export const APP_ROUTES = {
  home: "/",
  login: "/login",
  /** Tự đổi mật khẩu — mọi nhân viên; tài khoản còn mật khẩu tạm bị buộc vào đây (BE PASSWORD_CHANGE_REQUIRED). */
  changePassword: "/change-password",
} as const;

export const ADMIN_ROUTES = {
  home: ADMIN_BASE,
  customers: {
    create: `${ADMIN_BASE}/customers/create`,
    detail: (id: string) => `${ADMIN_BASE}/customers/${id}`,
    list: `${ADMIN_BASE}/customers`,
  },
  quotes: {
    create: `${ADMIN_BASE}/quotes/create`,
    /** Tạo báo giá cho một khách chọn sẵn (nút "Tạo báo giá" ở chi tiết khách). */
    createForCustomer: (customerId: string) =>
      `${ADMIN_BASE}/quotes/create?customerId=${encodeURIComponent(customerId)}`,
    detail: (id: string) => `${ADMIN_BASE}/quotes/${id}`,
    edit: (id: string) => `${ADMIN_BASE}/quotes/${id}/edit`,
    list: `${ADMIN_BASE}/quotes`,
    byCustomer: (customerId: string) =>
      `${ADMIN_BASE}/quotes?customerId=${encodeURIComponent(customerId)}`,
  },
  sampleRequests: {
    create: `${ADMIN_BASE}/sample-requests/create`,
    createForCustomer: (customerId: string) =>
      `${ADMIN_BASE}/sample-requests/create?customerId=${encodeURIComponent(customerId)}`,
    /** Làm mẫu cho một dòng báo giá (BE kiểm tra quote cùng khách + thiết kế + phôi). */
    createFromQuoteLine: (q: {
      quoteId: string;
      customerId: string;
      blankSku: string;
      designSnapshotId: string;
    }) => `${ADMIN_BASE}/sample-requests/create?${new URLSearchParams(q).toString()}`,
    detail: (id: string) => `${ADMIN_BASE}/sample-requests/${id}`,
    list: `${ADMIN_BASE}/sample-requests`,
    byCustomer: (customerId: string) =>
      `${ADMIN_BASE}/sample-requests?customerId=${encodeURIComponent(customerId)}`,
  },
  productionOrders: {
    detail: (id: string) => `${ADMIN_BASE}/production-orders/${id}`,
    list: `${ADMIN_BASE}/production-orders`,
    bySalesOrder: (orderId: string) =>
      `${ADMIN_BASE}/production-orders?salesOrderId=${encodeURIComponent(orderId)}`,
  },
  workshop: `${ADMIN_BASE}/workshop`,
  permissions: `${ADMIN_BASE}/permissions`,
  /** Quản lý tài khoản nhân viên — BE `UserManagementController` (PR #72, SCRUM-458). */
  users: {
    list: `${ADMIN_BASE}/users`,
    detail: (id: string) => `${ADMIN_BASE}/users/${encodeURIComponent(id)}`,
  },
  /** Hồ sơ hàng tồn — BE PR #119 `InventoryItemController` (`/api/v1/inventory/items`). */
  inventoryItems: {
    list: `${ADMIN_BASE}/inventory-items`,
    detail: (id: string) => `${ADMIN_BASE}/inventory-items/${id}`,
  },
  /** Bảng giá riêng của khách hàng — BE `CustomerPriceController` (`?customerId=` giữ khách đang chọn). */
  customerPrices: {
    list: `${ADMIN_BASE}/customer-prices`,
  },
  products: {
    create: `${ADMIN_BASE}/products/create`,
    detail: (id: string) => `${ADMIN_BASE}/products/${id}`,
    edit: (id: string) => `${ADMIN_BASE}/products/${id}/edit`,
    list: `${ADMIN_BASE}/products`,
  },
  purchaseOrders: {
    create: `${ADMIN_BASE}/purchase-orders/create`,
    detail: (id: string) => `${ADMIN_BASE}/purchase-orders/${id}`,
    // Sửa PO nháp (BE SCRUM-462)
    edit: (id: string) => `${ADMIN_BASE}/purchase-orders/${id}/edit`,
    list: `${ADMIN_BASE}/purchase-orders`,
  },
  invoices: {
    detail: (id: string) => `${ADMIN_BASE}/invoices/${id}`,
    list: `${ADMIN_BASE}/invoices`,
  },
  orders: {
    // Đơn công nợ vượt hạn mức chờ duyệt (SCRUM-427) — segment tĩnh, ưu tiên hơn [id]
    creditHolds: `${ADMIN_BASE}/orders/credit-holds`,
    detail: (id: string) => `${ADMIN_BASE}/orders/${id}`,
    list: `${ADMIN_BASE}/orders`,
  },
  packing: {
    detail: (id: string) => `${ADMIN_BASE}/packing/${id}`,
    list: `${ADMIN_BASE}/packing`,
    /** Trạm đóng gói của một lệnh chuyển kho nguyên chuyến (SCRUM-287 PR F9, BE `TransferPackController`). */
    transfer: (transferId: string) => `${ADMIN_BASE}/packing/transfers/${transferId}`,
  },
  picking: {
    detail: (id: string) => `${ADMIN_BASE}/picking/${id}`,
    list: `${ADMIN_BASE}/picking`,
  },
  /** Hàng đợi trả hàng về kệ (BE `GET /fulfillment/put-backs`, SCRUM-275) — lọc kho trên URL. */
  putBacks: {
    list: `${ADMIN_BASE}/put-backs`,
    listInWarehouse: (warehouseId: string) =>
      `${ADMIN_BASE}/put-backs?warehouse=${encodeURIComponent(warehouseId)}`,
  },
  receipts: {
    create: `${ADMIN_BASE}/receipts/create`,
    // Tạo phiếu từ một PO đã chọn sẵn (vd nút "Nhận hàng" ở màn PO)
    createFromPo: (poId: string) =>
      `${ADMIN_BASE}/receipts/create?poId=${encodeURIComponent(poId)}`,
    // Hàng về không có PO (BR-RCP-002, SCRUM-478): cùng trang tạo phiếu, chế độ "không có đơn đặt hàng"
    createWithoutPo: `${ADMIN_BASE}/receipts/create?mode=without-po`,
    detail: (id: string) => `${ADMIN_BASE}/receipts/${id}`,
    list: `${ADMIN_BASE}/receipts`,
  },
  replenishment: {
    list: `${ADMIN_BASE}/replenishment`,
  },
  /** Từ điển thuộc tính (BE PR #113) — thay màn "Thuộc tính biến thể" dựng từ dữ liệu mẫu. */
  attributes: `${ADMIN_BASE}/attributes`,
  /** Thương hiệu & danh mục — BE `ProductTaxonomyController` (gate product-products). */
  taxonomy: {
    list: `${ADMIN_BASE}/taxonomy`,
  },
  transfers: {
    create: `${ADMIN_BASE}/transfers/create`,
    detail: (id: string) => `${ADMIN_BASE}/transfers/${id}`,
    edit: (id: string) => `${ADMIN_BASE}/transfers/${id}/edit`,
    list: `${ADMIN_BASE}/transfers`,
  },
  /** Lô giao chờ xuất / đã giao (BE `ShipmentController`, PR #137). */
  shipments: {
    list: `${ADMIN_BASE}/shipments`,
    detail: (id: string) => `${ADMIN_BASE}/shipments/${id}`,
  },
  /** Chuyến xe: quét kiện lên xe, bàn giao hãng (BE `DispatchController`, PR #137). */
  loads: {
    list: `${ADMIN_BASE}/loads`,
    detail: (id: string) => `${ADMIN_BASE}/loads/${id}`,
    manifest: (id: string) => `${ADMIN_BASE}/loads/${id}/manifest`,
  },
  /** Danh mục kho — BE `WarehouseController` (resource `warehouse-warehouses`, docs 06 §4.1 bước 1). */
  warehouses: {
    // Khai báo kho mới là modal trên trang này (không có route riêng)
    list: `${ADMIN_BASE}/warehouses`,
  },
  /**
   * Tab "Kho & bản đồ" (module 06) — `root` là bước chọn kho; trang làm việc theo một kho nằm dưới prefix
   * kho (duy nhất, không đổi — BR-10 / BR-13). Tiền tố `/admin/warehouse-map` = route BE khai báo cho
   * resource `warehouse-locations` (`LayoutController`).
   */
  warehouseMap: {
    root: `${ADMIN_BASE}/warehouse-map`,
    of: (prefix: string) => `${ADMIN_BASE}/warehouse-map/${encodeURIComponent(prefix)}`,
    slotting: (prefix: string) =>
      `${ADMIN_BASE}/warehouse-map/${encodeURIComponent(prefix)}/slotting`,
  },
  /** Danh mục loại xe (container, xe tải, bán tải) — BE `VehicleTypeController`, PR #153. */
  vehicleTypes: `${ADMIN_BASE}/vehicle-types`,
  /** Kế hoạch xếp xe (SCRUM-287 PR F4): danh sách, lập mới, chi tiết — BE `LoadPlanController`, PR #161. */
  loadPlans: {
    list: `${ADMIN_BASE}/load-plans`,
    create: `${ADMIN_BASE}/load-plans/create`,
    /** "Lập kế hoạch xe" từ lệnh chuyển kho đã đóng gói (SCRUM-287 PR F9): nguồn TRANSFER, kho nguồn và lệnh chọn sẵn. */
    createFromTransfer: (transferId: string, warehouseId: string) =>
      `${ADMIN_BASE}/load-plans/create?sourceType=TRANSFER&transferOrderId=${encodeURIComponent(transferId)}&warehouseId=${encodeURIComponent(warehouseId)}`,
    detail: (id: string) => `${ADMIN_BASE}/load-plans/${id}`,
    /** Phiếu xếp hàng in được của một xe (SCRUM-287 PR F6). */
    print: (id: string, seq: number) => `${ADMIN_BASE}/load-plans/${id}/vehicles/${seq}/print`,
  },
  suppliers: {
    list: `${ADMIN_BASE}/suppliers`,
    create: `${ADMIN_BASE}/suppliers/create`,
    detail: (id: string) => `${ADMIN_BASE}/suppliers/${id}`,
    edit: (id: string) => `${ADMIN_BASE}/suppliers/${id}/edit`,
    /** Danh sách PO lọc theo NCC — BE PO list hỗ trợ `?supplierId=` (BE PR #36). */
    purchaseOrders: (id: string) =>
      `${ADMIN_BASE}/purchase-orders?supplierId=${encodeURIComponent(id)}`,
  },
} as const;

/** Portal khách hàng B2B (Mode B) — tách khỏi back-office, cùng phiên đăng nhập BFF. */
export const PORTAL_ROUTES = {
  home: PORTAL_BASE,
  /** Trang kích hoạt từ email mời — BE `PORTAL_ACTIVATION_URL`, token nằm ở `#token=`. */
  activate: `${PORTAL_BASE}/activate`,
  quotes: {
    list: `${PORTAL_BASE}/quotes`,
    detail: (id: string) => `${PORTAL_BASE}/quotes/${id}`,
  },
  samples: {
    list: `${PORTAL_BASE}/samples`,
    detail: (id: string) => `${PORTAL_BASE}/samples/${id}`,
  },
  orders: {
    list: `${PORTAL_BASE}/orders`,
    detail: (id: string) => `${PORTAL_BASE}/orders/${id}`,
  },
} as const;
