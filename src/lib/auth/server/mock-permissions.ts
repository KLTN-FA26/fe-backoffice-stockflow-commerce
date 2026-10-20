import "server-only";

import {
  ATTRIBUTE_PERMISSIONS,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  GOODS_RECEIPT_PERMISSIONS,
  IDENTITY_PERMISSIONS,
  IDENTITY_USER_PERMISSIONS,
  INVENTORY_ITEM_PERMISSIONS,
  INVENTORY_OVERVIEW_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  ORDER_PERMISSIONS,
  PO_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  QC_TASK_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
  TRANSFER_PERMISSIONS,
  VARIANT_PERMISSIONS,
  WAREHOUSE_LOCATION_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants/permissions";

import { toBackendRoles } from "@/lib/api/mock-backend-roles";

import type { PermissionCode } from "@/lib/auth/me-permissions";

// Seed BE V20260903000100: goods-receipts VIEW_PAGE/READ/CREATE/UPDATE cho WAREHOUSE_STAFF,
// WAREHOUSE_MANAGER, PROCUREMENT_STAFF; QC_STAFF chỉ VIEW_PAGE/READ + qc-tasks:APPROVE.
// WAREHOUSE_STAFF KHÔNG có purchase-orders:READ (đã chốt giữ nguyên seed, SCRUM-436).
const GR = GOODS_RECEIPT_PERMISSIONS;
const QC = QC_TASK_PERMISSIONS;
const GR_WORK = [GR.viewPage, GR.read, GR.create, GR.update];
// Seed BE: inventory-transfer-orders — WAREHOUSE_MANAGER đủ 5 quyền (gồm APPROVE), INVENTORY_PLANNER
// VIEW_PAGE/READ/CREATE/UPDATE, WAREHOUSE_STAFF VIEW_PAGE/READ/UPDATE (V20261010000500).
// fulfillment-shipments VIEW_PAGE/READ/CREATE/UPDATE cho WAREHOUSE_STAFF / MANAGER / ORDER_COORDINATOR.
const TO = TRANSFER_PERMISSIONS;
const TO_STAFF = [TO.viewPage, TO.read, TO.update];
const SHIP = Object.values(SHIPMENT_PERMISSIONS);

// Seed BE V20260903000100 + V20260919001300 (fulfillment):
// WAREHOUSE_STAFF / WAREHOUSE_MANAGER — pick-lists VIEW_PAGE/READ/UPDATE, packages
// VIEW_PAGE/READ/CREATE; QC_STAFF — pick-lists:READ + packages READ/CREATE (không VIEW_PAGE).
// identity-users:READ chỉ ECOMMERCE_ADMIN (System Admin mock-only được toàn quyền).
const PICK = FULFILLMENT_PICK_PERMISSIONS;
const PACK = FULFILLMENT_PACKAGE_PERMISSIONS;
const INV = INVENTORY_PERMISSIONS;
// Seed BE V20260928006000: ECOMMERCE_ADMIN có product-attributes và product-variants đủ quyền (admin mock
// là System Admin: toàn quyền như mọi nhóm khác ở đây).
const PRODUCT_STRUCTURE = [
  ...Object.values(VARIANT_PERMISSIONS),
  ...Object.values(ATTRIBUTE_PERMISSIONS),
];
// Seed BE: WAREHOUSE_STAFF / INVENTORY_PLANNER giữ inventory-stock-items:READ/UPDATE và
// inventory-alerts:READ (V20261014000900); WAREHOUSE_STAFF thêm warehouse-locations:READ (V20260928006000).
const INVENTORY_FLOOR = [
  INV.adjustmentRead,
  INV.stockUpdate,
  INV.stockRead,
  INV.movementRead,
  INV.alertRead,
];
const INVENTORY_ALL = Object.values(INV);
// Seed BE V20260903000100: WAREHOUSE_STAFF / MANAGER đọc tồn + giữ chỗ; INVENTORY_PLANNER và
// QC_STAFF chỉ đọc tồn (inventory-stock-items VIEW_PAGE/READ). V20261014000900: inventory-alerts:READ
// cho WAREHOUSE_MANAGER / INVENTORY_PLANNER / WAREHOUSE_STAFF (QC_STAFF không có).
const OV = INVENTORY_OVERVIEW_PERMISSIONS;
const STOCK_READ = [OV.stockViewPage, OV.stockRead];
const OVERVIEW_ALL = Object.values(OV);
const FULFILLMENT_FLOOR = [...Object.values(PICK), ...Object.values(PACK)];
// Seed V20260928006000: warehouse-warehouses READ (danh mục kho) cho WAREHOUSE_MANAGER / STAFF,
// INVENTORY_PLANNER, PROCUREMENT_STAFF; V20261017000800 thêm SALES_STAFF — không có QC_STAFF.
const WAREHOUSE_READ = WAREHOUSE_PERMISSIONS.read;
// Seed BE V20260928006000 (BE PR #119): hồ sơ hàng tồn — WAREHOUSE_MANAGER / INVENTORY_PLANNER mọi
// quyền, WAREHOUSE_STAFF / PROCUREMENT_STAFF chỉ VIEW_PAGE + READ; role catalog không có.
const ITEM = INVENTORY_ITEM_PERMISSIONS;
const ITEM_READ = [ITEM.viewPage, ITEM.read];
const ITEM_ALL = Object.values(ITEM);
const WH_WORK = [
  ...GR_WORK,
  ...FULFILLMENT_FLOOR,
  ...INVENTORY_FLOOR,
  ...OVERVIEW_ALL,
  WAREHOUSE_READ,
  WAREHOUSE_LOCATION_PERMISSIONS.read,
  ...ITEM_READ,
];

/** Explicit demo session responses keyed by existing staff IDs, never computed from roles. */
const MOCK_USER_GRANTS: Record<string, readonly PermissionCode[]> = {
  "USER-ADMIN-01": [
    ...Object.values(SUPPLIER_PERMISSIONS),
    ...Object.values(PO_PERMISSIONS),
    ...Object.values(ORDER_PERMISSIONS),
    ...Object.values(PRODUCT_PERMISSIONS),
    ...PRODUCT_STRUCTURE,
    ...Object.values(IDENTITY_PERMISSIONS),
    ...Object.values(GR),
    ...Object.values(QC),
    ...FULFILLMENT_FLOOR,
    IDENTITY_USER_PERMISSIONS.read,
    ...INVENTORY_ALL,
    ...OVERVIEW_ALL,
    WAREHOUSE_READ,
    WAREHOUSE_LOCATION_PERMISSIONS.read,
    ...Object.values(TO),
    ...SHIP,
    ...ITEM_ALL,
  ],
  "USER-PROC-01": [
    SUPPLIER_PERMISSIONS.viewPage,
    SUPPLIER_PERMISSIONS.read,
    SUPPLIER_PERMISSIONS.create,
    SUPPLIER_PERMISSIONS.update,
    SUPPLIER_PERMISSIONS.export,
    PO_PERMISSIONS.viewPage,
    PO_PERMISSIONS.read,
    PO_PERMISSIONS.create,
    PO_PERMISSIONS.update,
    PO_PERMISSIONS.export,
    ...GR_WORK,
    QC.viewPage,
    QC.read,
    WAREHOUSE_READ,
    ...ITEM_READ,
  ],
  // INVENTORY_PLANNER (seed V20261010000500): tạo / sửa / gửi duyệt / huỷ, KHÔNG duyệt
  "USER-PLAN-01": [
    ...INVENTORY_FLOOR,
    ...STOCK_READ,
    OV.alertRead,
    WAREHOUSE_READ,
    TO.viewPage,
    TO.read,
    TO.create,
    TO.update,
    ...ITEM_ALL,
  ],
  // Existing USER-ADMIN-01 is also the only Warehouse Manager; WH users are staff.
  "USER-WH-01": [...WH_WORK, ...TO_STAFF, ...SHIP],
  "USER-WH-02": [...WH_WORK, ...TO_STAFF, ...SHIP],
  "USER-WH-03": [...WH_WORK, ...TO_STAFF, ...SHIP],
  "USER-WH-04": [...WH_WORK, ...TO_STAFF, ...SHIP],
  "USER-QC-01": [
    GR.viewPage,
    GR.read,
    QC.viewPage,
    QC.read,
    QC.approve,
    ...STOCK_READ,
    PICK.read,
    PACK.read,
    PACK.create,
  ],
  "USER-ACC-01": [SUPPLIER_PERMISSIONS.viewPage, SUPPLIER_PERMISSIONS.read],
  // ECOMMERCE_ADMIN: duyệt / xuất bản nhưng không tạm ngưng / ngừng kinh doanh (product-lifecycle chỉ
  // System Admin, BE PR #123)
  "USER-ECAD-01": [
    ...Object.values(PRODUCT_PERMISSIONS).filter((code) => code !== PRODUCT_PERMISSIONS.lifecycle),
    ...PRODUCT_STRUCTURE,
    ...Object.values(SUPPLIER_PERMISSIONS),
    IDENTITY_USER_PERMISSIONS.read,
  ],
  "USER-SALE-01": [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read, WAREHOUSE_READ],
  "USER-SALE-02": [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read, WAREHOUSE_READ],
  "USER-SALE-03": [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read, WAREHOUSE_READ],
  // Order Coordinator + Warehouse Staff → thêm quyền kho xuất của WAREHOUSE_STAFF
  "USER-COORD-01": [
    ...Object.values(ORDER_PERMISSIONS),
    ...FULFILLMENT_FLOOR,
    ...INVENTORY_FLOOR,
    ...OVERVIEW_ALL,
    WAREHOUSE_READ,
    ...TO_STAFF,
    ...SHIP,
    ...ITEM_READ,
  ],
};

export function mockSessionPermissions(userId: string, roles: readonly string[]) {
  return {
    // BE trả mã vai trò (`MyPermissionsResponse.roles`) — màn fulfillment gate kép theo mã này
    roles: toBackendRoles(roles),
    permissions: [...new Set(MOCK_USER_GRANTS[userId] ?? [])].sort(),
    dataScope: "ALL" as const,
  };
}
