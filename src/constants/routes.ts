const ADMIN_BASE = "/admin";

export const APP_ROUTES = {
  home: "/",
  login: "/login",
} as const;

export const ADMIN_ROUTES = {
  home: ADMIN_BASE,
  // FE back-office convention. TODO(contract): BE catalog route currently says /inventory/stock.
  inventory: `${ADMIN_BASE}/inventory`,
  permissions: `${ADMIN_BASE}/permissions`,
  products: {
    create: `${ADMIN_BASE}/products/create`,
    detail: (id: string) => `${ADMIN_BASE}/products/${id}`,
    edit: (id: string) => `${ADMIN_BASE}/products/${id}/edit`,
    list: `${ADMIN_BASE}/products`,
    skuDetail: (id: string) => `${ADMIN_BASE}/products/sku/${id}`,
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
  receipts: {
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
