/**
 * Mock route — `GET /identity/me/permissions` (BE PR #39), chỉ dùng khi USE_MOCK=true.
 *
 * BE thật tính quyền theo role + bảng quyền admin cấu hình. Mock không có màn cấu hình đó nên
 * dùng bảng dưới đây, chép theo seed BE (V20260903000100 + V20260928006000 + V20260930000100 +
 * V20261001000100 của BE #40). Bảng này CHỈ
 * phục vụ demo/mock — code FE đọc quyền qua `/me/permissions`, không đọc bảng này.
 */

import {
  GOODS_RECEIPT_PERMISSIONS,
  ORDER_PERMISSIONS,
  PO_PERMISSIONS,
  QC_TASK_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
} from "@/constants/permissions";

import { registerMockRoute } from "./mock-adapter";

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

const MOCK_PERMISSIONS_BY_ROLE: Record<string, readonly string[]> = {
  "System Admin": [...ALL_SUPPLIER, ...ALL_PO, ...ORDER_ALL, ...ALL_GR_QC],
  "E-commerce Admin": ALL_SUPPLIER,
  "Order Coordinator": ORDER_ALL,
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
  "Warehouse Manager": [PO.viewPage, PO.read, PO.approve, ...GR_WORK],
  "Warehouse Staff": GR_WORK,
  "QC Staff": [GR.viewPage, GR.read, QC.viewPage, QC.read, QC.approve],
  Accountant: [viewPage, read],
};

export function registerMeMockRoutes(): void {
  registerMockRoute("GET", "/identity/me/permissions", async () => {
    const { useAuthStore } = await import("@/lib/auth/auth-store");
    const roles = useAuthStore.getState().effectiveRoles();
    const permissions = [
      ...new Set(roles.flatMap((r) => MOCK_PERMISSIONS_BY_ROLE[r] ?? [])),
    ].sort();
    return { status: 200, data: { roles, permissions, dataScope: "ALL" }, headers: {} };
  });
}
