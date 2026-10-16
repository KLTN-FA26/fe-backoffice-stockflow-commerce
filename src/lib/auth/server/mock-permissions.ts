import "server-only";

import {
  CREDIT_HOLD_PERMISSIONS,
  CUSTOMER_CREDIT_PROFILE_PERMISSIONS,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  GOODS_RECEIPT_PERMISSIONS,
  IDENTITY_PERMISSIONS,
  IDENTITY_USER_PERMISSIONS,
  ORDER_PERMISSIONS,
  PO_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  QC_TASK_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
  TRANSFER_PERMISSIONS,
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
const FULFILLMENT_FLOOR = [...Object.values(PICK), ...Object.values(PACK)];
const WH_WORK = [...GR_WORK, ...FULFILLMENT_FLOOR];

// Seed BE develop (đơn bán):
// - V20260903000100: sales-orders APPROVE (release) chỉ ORDER_COORDINATOR.
// - V20261013000200: sales-order-cancellations:UPDATE cho SALES_STAFF + ORDER_COORDINATOR.
// - V20261013000400: sales-order-credit-holds APPROVE chỉ ACCOUNTANT; Sales/Coordinator chỉ xem.
const ORDER = ORDER_PERMISSIONS;
const CREDIT_VIEW = [CREDIT_HOLD_PERMISSIONS.viewPage, CREDIT_HOLD_PERMISSIONS.read];
const CREDIT_ALL = Object.values(CREDIT_HOLD_PERMISSIONS);
// V20261013000400: customer-credit-profiles READ cho ACCOUNTANT / SALES_STAFF / ORDER_COORDINATOR
// (FE chỉ dùng READ — `GET /orders/credit-position/{customerId}`).
const CREDIT_PROFILE_READ = CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read;
const ORDER_SALES = [ORDER.viewPage, ORDER.read, ORDER.cancel, ...CREDIT_VIEW, CREDIT_PROFILE_READ];
const ORDER_ALL = [...Object.values(ORDER), ...CREDIT_VIEW, CREDIT_PROFILE_READ];

/** Explicit demo session responses keyed by existing staff IDs, never computed from roles. */
const MOCK_USER_GRANTS: Record<string, readonly PermissionCode[]> = {
  "USER-ADMIN-01": [
    ...Object.values(SUPPLIER_PERMISSIONS),
    ...Object.values(PO_PERMISSIONS),
    ...Object.values(ORDER_PERMISSIONS),
    ...CREDIT_ALL,
    CREDIT_PROFILE_READ,
    ...Object.values(PRODUCT_PERMISSIONS),
    ...Object.values(IDENTITY_PERMISSIONS),
    ...Object.values(GR),
    ...Object.values(QC),
    ...FULFILLMENT_FLOOR,
    IDENTITY_USER_PERMISSIONS.read,
    ...Object.values(TO),
    ...SHIP,
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
  ],
  // INVENTORY_PLANNER (seed V20261010000500): tạo / sửa / gửi duyệt / huỷ, KHÔNG duyệt
  "USER-PLAN-01": [TO.viewPage, TO.read, TO.create, TO.update],
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
    PICK.read,
    PACK.read,
    PACK.create,
  ],
  "USER-ACC-01": [
    SUPPLIER_PERMISSIONS.viewPage,
    SUPPLIER_PERMISSIONS.read,
    ...CREDIT_ALL,
    CREDIT_PROFILE_READ,
  ],
  "USER-ECAD-01": [
    ...Object.values(PRODUCT_PERMISSIONS),
    ...Object.values(SUPPLIER_PERMISSIONS),
    IDENTITY_USER_PERMISSIONS.read,
  ],
  "USER-SALE-01": ORDER_SALES,
  "USER-SALE-02": ORDER_SALES,
  "USER-SALE-03": ORDER_SALES,
  // Order Coordinator + Warehouse Staff: đơn bán / công nợ + quyền kho xuất, chuyển kho, chuyến xe
  // của WAREHOUSE_STAFF
  "USER-COORD-01": [...ORDER_ALL, ...FULFILLMENT_FLOOR, ...TO_STAFF, ...SHIP],
};

export function mockSessionPermissions(userId: string, roles: readonly string[]) {
  return {
    // BE trả mã vai trò (`MyPermissionsResponse.roles`) — màn fulfillment gate kép theo mã này
    roles: toBackendRoles(roles),
    permissions: [...(MOCK_USER_GRANTS[userId] ?? [])].sort(),
    dataScope: "ALL" as const,
  };
}
