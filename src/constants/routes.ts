const ADMIN_BASE = "/admin";

export const APP_ROUTES = {
  home: "/",
  login: "/login",
} as const;

export const ADMIN_ROUTES = {
  home: ADMIN_BASE,
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
