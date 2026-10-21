const ADMIN_BASE = "/admin";
const PORTAL_BASE = "/portal";

export const APP_ROUTES = {
  home: "/",
  login: "/login",
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
  },
  picking: {
    detail: (id: string) => `${ADMIN_BASE}/picking/${id}`,
    list: `${ADMIN_BASE}/picking`,
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
  /** Kế hoạch xếp xe — SCRUM-452, đang phát triển. */
  loadPlans: `${ADMIN_BASE}/load-plans`,
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
