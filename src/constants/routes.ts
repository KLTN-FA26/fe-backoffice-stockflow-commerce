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
    list: `${ADMIN_BASE}/quotes`,
    byCustomer: (customerId: string) =>
      `${ADMIN_BASE}/quotes?customerId=${encodeURIComponent(customerId)}`,
  },
  sampleRequests: {
    create: `${ADMIN_BASE}/sample-requests/create`,
    createForCustomer: (customerId: string) =>
      `${ADMIN_BASE}/sample-requests/create?customerId=${encodeURIComponent(customerId)}`,
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
  products: {
    create: `${ADMIN_BASE}/products/create`,
    detail: (id: string) => `${ADMIN_BASE}/products/${id}`,
    edit: (id: string) => `${ADMIN_BASE}/products/${id}/edit`,
    list: `${ADMIN_BASE}/products`,
  },
  purchaseOrders: {
    create: `${ADMIN_BASE}/purchase-orders/create`,
    detail: (id: string) => `${ADMIN_BASE}/purchase-orders/${id}`,
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
  variants: {
    detail: (id: string) => `${ADMIN_BASE}/variants/${id}`,
    list: `${ADMIN_BASE}/variants`,
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
} as const;
