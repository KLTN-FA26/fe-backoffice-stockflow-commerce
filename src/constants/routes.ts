const ADMIN_BASE = "/admin";

export const APP_ROUTES = {
  home: "/",
  login: "/login",
} as const;

export const ADMIN_ROUTES = {
  home: ADMIN_BASE,
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
  /** Từ điển thuộc tính (BE PR #113) — thay màn "Thuộc tính biến thể" dựng từ dữ liệu mẫu. */
  attributes: `${ADMIN_BASE}/attributes`,
  transfers: {
    create: `${ADMIN_BASE}/transfers/create`,
    detail: (id: string) => `${ADMIN_BASE}/transfers/${id}`,
    edit: (id: string) => `${ADMIN_BASE}/transfers/${id}/edit`,
    list: `${ADMIN_BASE}/transfers`,
  },
  shipments: {
    list: `${ADMIN_BASE}/shipments`,
    /** Màn xếp hàng lên xe của một chuyến (quét kiện). */
    loading: (id: string) => `${ADMIN_BASE}/shipments/${id}`,
    manifest: (id: string) => `${ADMIN_BASE}/shipments/${id}/manifest`,
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
