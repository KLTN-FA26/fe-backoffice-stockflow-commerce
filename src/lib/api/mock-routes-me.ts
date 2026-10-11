/**
 * Mock route — `GET /identity/me/permissions` (BE PR #39), chỉ dùng khi USE_MOCK=true.
 *
 * BE thật tính quyền theo role + bảng quyền admin cấu hình. Mock không có màn cấu hình đó nên
 * dùng bảng dưới đây, chép theo seed BE (V20260903000100 + V20260928006000 + V20260930000100 +
 * V20261001000100 của BE #40). Bảng này CHỈ
 * phục vụ demo/mock — code FE đọc quyền qua `/me/permissions`, không đọc bảng này.
 */

import {
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  GOODS_RECEIPT_PERMISSIONS,
  IDENTITY_USER_PERMISSIONS,
  ORDER_PERMISSIONS,
  PO_PERMISSIONS,
  QC_TASK_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
} from "@/constants/permissions";

import { registerMockRoute } from "./mock-adapter";

import type { RoleName } from "@/lib/auth/roles";

const ALL_SUPPLIER = Object.values(SUPPLIER_PERMISSIONS);
const ALL_PO = Object.values(PO_PERMISSIONS);
const { viewPage, read, create, update, export: exportCode } = SUPPLIER_PERMISSIONS;
const PO = PO_PERMISSIONS;

// Seed BE V20260903000100: chỉ ORDER_COORDINATOR có sales-orders:APPROVE ("System Admin" là
// role mock-only, được toàn quyền như NCC).
// SALES_STAFF: VIEW_PAGE/READ/CREATE/UPDATE; ORDER_COORDINATOR: thêm APPROVE (huỷ đơn admin).
const ORDER_VIEW = [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read];
const ORDER_ALL = Object.values(ORDER_PERMISSIONS);

// Seed BE V20260903000100: goods-receipts VIEW_PAGE/READ/CREATE/UPDATE cho WAREHOUSE_STAFF,
// WAREHOUSE_MANAGER, PROCUREMENT_STAFF; QC_STAFF chỉ VIEW_PAGE/READ + qc-tasks:APPROVE.
// WAREHOUSE_STAFF KHÔNG có purchase-orders:READ (đã chốt giữ nguyên seed, SCRUM-436).
const GR = GOODS_RECEIPT_PERMISSIONS;
const QC = QC_TASK_PERMISSIONS;
const GR_WORK = [GR.viewPage, GR.read, GR.create, GR.update];
const ALL_GR_QC = [...Object.values(GR), ...Object.values(QC)];

// Seed BE V20260903000100 + V20260919001300 (fulfillment):
// WAREHOUSE_STAFF / WAREHOUSE_MANAGER — pick-lists VIEW_PAGE/READ/UPDATE, packages
// VIEW_PAGE/READ/CREATE; ORDER_COORDINATOR — pick-lists như trên + packages:CREATE (không READ);
// QC_STAFF — pick-lists:READ + packages READ/CREATE (không VIEW_PAGE ở cả hai).
// Vai trò kho KHÔNG có sales-orders:READ; identity-users:READ chỉ ECOMMERCE_ADMIN.
const PICK = FULFILLMENT_PICK_PERMISSIONS;
const PACK = FULFILLMENT_PACKAGE_PERMISSIONS;
const FULFILLMENT_FLOOR = [...Object.values(PICK), ...Object.values(PACK)];
const USERS_READ = IDENTITY_USER_PERMISSIONS.read;

const MOCK_PERMISSIONS_BY_ROLE: Record<string, readonly string[]> = {
  "System Admin": [
    ...ALL_SUPPLIER,
    ...ALL_PO,
    ...ORDER_ALL,
    ...ALL_GR_QC,
    ...FULFILLMENT_FLOOR,
    USERS_READ,
  ],
  "E-commerce Admin": [...ALL_SUPPLIER, USERS_READ],
  "Order Coordinator": [...ORDER_ALL, ...Object.values(PICK), PACK.create],
  "Sales Staff": ORDER_VIEW,
  // Seed BE: PROCUREMENT_STAFF — NCC: VIEW_PAGE, READ, CREATE, UPDATE, EXPORT (không DELETE);
  // PO: VIEW_PAGE, READ, CREATE, UPDATE, EXPORT (không APPROVE).
  "Procurement Staff": [
    viewPage,
    read,
    create,
    update,
    exportCode,
    PO.viewPage,
    PO.read,
    PO.create,
    PO.update,
    PO.export,
    ...GR_WORK,
    QC.viewPage,
    QC.read,
  ],
  // BE #40: WAREHOUSE_MANAGER duyệt PO (VIEW_PAGE, READ, APPROVE); không có quyền NCC.
  "Warehouse Manager": [PO.viewPage, PO.read, PO.approve, ...GR_WORK, ...FULFILLMENT_FLOOR],
  "Warehouse Staff": [...GR_WORK, ...FULFILLMENT_FLOOR],
  "QC Staff": [
    GR.viewPage,
    GR.read,
    QC.viewPage,
    QC.read,
    QC.approve,
    PICK.read,
    PACK.read,
    PACK.create,
  ],
  Accountant: [viewPage, read],
};

/** Tên vai trò của mock-data → mã vai trò BE (`common/security/Roles.java`). */
export const BACKEND_ROLE_BY_MOCK_ROLE: Record<RoleName, string> = {
  "System Admin": "SYSTEM_ADMIN",
  "Procurement Staff": "PROCUREMENT_STAFF",
  "Warehouse Staff": "WAREHOUSE_STAFF",
  "Warehouse Manager": "WAREHOUSE_MANAGER",
  "Inventory Planner": "INVENTORY_PLANNER",
  "QC Staff": "QC_STAFF",
  Accountant: "ACCOUNTANT",
  "E-commerce Admin": "ECOMMERCE_ADMIN",
  "Sales Staff": "SALES_STAFF",
  "Order Coordinator": "ORDER_COORDINATOR",
};

/** Mã vai trò BE của người đang đăng nhập mock (tôn trọng vai trò giả lập). */
export async function mockBackendRoles(): Promise<string[]> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  const roles = useAuthStore.getState().effectiveRoles();
  return roles.map((role) => BACKEND_ROLE_BY_MOCK_ROLE[role]).sort();
}

export function registerMeMockRoutes(): void {
  registerMockRoute("GET", "/identity/me/permissions", async () => {
    const { useAuthStore } = await import("@/lib/auth/auth-store");
    const mockRoles = useAuthStore.getState().effectiveRoles();
    const permissions = [
      ...new Set(mockRoles.flatMap((r) => MOCK_PERMISSIONS_BY_ROLE[r] ?? [])),
    ].sort();
    // BE trả mã vai trò (`MyPermissionsResponse.roles`), không phải tên hiển thị
    const roles = await mockBackendRoles();
    return { status: 200, data: { roles, permissions, dataScope: "ALL" }, headers: {} };
  });
}
