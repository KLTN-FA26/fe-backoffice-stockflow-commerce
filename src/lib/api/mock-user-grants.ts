/**
 * Quyền của từng tài khoản demo (USE_MOCK=true) — dùng chung cho BFF mock (`/identity/me/permissions`,
 * server) và mock backend phía client (`lib/api/mock-routes-*`, cổng quyền thay `@RequiresPermission`).
 * Không import `server-only` để mock backend đọc được. Tính theo userId, KHÔNG suy từ tên vai trò.
 */

import {
  ATTRIBUTE_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  CUSTOMER_PRICE_PERMISSIONS,
  FULFILLMENT_CARRIER_PERMISSIONS,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PACKING_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  FULFILLMENT_PICKING_PERMISSIONS,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS,
  FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS,
  GOODS_RECEIPT_PERMISSIONS,
  IDENTITY_PERMISSIONS,
  INVENTORY_ITEM_PERMISSIONS,
  INVENTORY_OVERVIEW_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  LOAD_ESTIMATE_PERMISSIONS,
  LOAD_PLAN_PERMISSIONS,
  ORDER_PERMISSIONS,
  PO_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  QC_TASK_PERMISSIONS,
  REPORTING_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  SUPPLIER_ITEM_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
  TRANSFER_PERMISSIONS,
  VARIANT_PERMISSIONS,
  VEHICLE_TYPE_PERMISSIONS,
  WAREHOUSE_LOCATION_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants/permissions";

import type { PermissionCode } from "@/lib/auth/me-permissions";

// Seed BE V20260903000100: goods-receipts VIEW_PAGE/READ/CREATE/UPDATE cho WAREHOUSE_STAFF,
// WAREHOUSE_MANAGER, PROCUREMENT_STAFF; QC_STAFF chỉ VIEW_PAGE/READ + qc-tasks:APPROVE.
// WAREHOUSE_STAFF KHÔNG có purchase-orders:READ (đã chốt giữ nguyên seed, SCRUM-436).
const GR = GOODS_RECEIPT_PERMISSIONS;
const QC = QC_TASK_PERMISSIONS;
const GR_WORK = [GR.viewPage, GR.read, GR.create, GR.update];
// Seed BE: inventory-transfer-orders — WAREHOUSE_MANAGER đủ 5 quyền (gồm APPROVE), INVENTORY_PLANNER
// VIEW_PAGE/READ/CREATE/UPDATE, WAREHOUSE_STAFF VIEW_PAGE/READ/UPDATE (V20261010000500).
// fulfillment-shipments VIEW_PAGE/READ cho WAREHOUSE_STAFF / MANAGER / ORDER_COORDINATOR (ghi đã tách ra
// các resource fulfillment-dispatch / -carriers / -load-cancellations / -delivery-outcomes, BE PR #148).
const TO = TRANSFER_PERMISSIONS;
const TO_STAFF = [TO.viewPage, TO.read, TO.update];
const SHIP = Object.values(SHIPMENT_PERMISSIONS);

// Seed BE V20260903000100 + V20260919001300 + V20261022000200 (fulfillment, BE PR #148):
// - đọc: WAREHOUSE_STAFF / WAREHOUSE_MANAGER có pick-lists VIEW_PAGE/READ + packages VIEW_PAGE/READ;
//   QC_STAFF có pick-lists:READ + packages:READ (không VIEW_PAGE).
// - ghi, mỗi nhóm một resource riêng (xem các tập quyền bên dưới).
const PICK = FULFILLMENT_PICK_PERMISSIONS;
const PACK = FULFILLMENT_PACKAGE_PERMISSIONS;
const TA = Object.values(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS);
const OVERSIGHT = Object.values(FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS);
const PICKING = Object.values(FULFILLMENT_PICKING_PERMISSIONS);
const PACKING_WORK = [FULFILLMENT_PACKING_PERMISSIONS.read, FULFILLMENT_PACKING_PERMISSIONS.update];
const PACKING_ALL = Object.values(FULFILLMENT_PACKING_PERMISSIONS);
const REVERIFY = Object.values(FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS);
const DISPATCH = Object.values(FULFILLMENT_DISPATCH_PERMISSIONS);
const LOAD_CANCEL = Object.values(FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS);
const CARRIER = Object.values(FULFILLMENT_CARRIER_PERMISSIONS);
const OUTCOME = FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS;
// Seed BE V20261022000700 (BE PR #153): fulfillment-vehicle-types VIEW_PAGE + READ cho WAREHOUSE_STAFF /
// WAREHOUSE_MANAGER / ORDER_COORDINATOR / SYSTEM_ADMIN; UPDATE chỉ WAREHOUSE_MANAGER / SYSTEM_ADMIN.
const VT = VEHICLE_TYPE_PERMISSIONS;
const VEHICLE_TYPE_READ = [VT.viewPage, VT.read];
const VEHICLE_TYPE_ALL = Object.values(VT);
// Seed BE V20261022001200 (BE PR #160): fulfillment-load-estimates CREATE + READ cho ORDER_COORDINATOR /
// WAREHOUSE_MANAGER / SYSTEM_ADMIN (không có dispatcher; WAREHOUSE_STAFF không có).
const LOAD_ESTIMATE = Object.values(LOAD_ESTIMATE_PERMISSIONS);
// Seed BE V20261022001300 (BE PR #161): fulfillment-load-plans VIEW_PAGE + READ cho WAREHOUSE_STAFF /
// WAREHOUSE_MANAGER / ORDER_COORDINATOR / SYSTEM_ADMIN; CREATE + UPDATE chỉ WAREHOUSE_STAFF / WAREHOUSE_MANAGER /
// SYSTEM_ADMIN (docs 09 §2: nhân viên điều phối kho lập và chốt kế hoạch).
const LP = LOAD_PLAN_PERMISSIONS;
const LOAD_PLAN_READ = [LP.viewPage, LP.read];
const LOAD_PLAN_ALL = Object.values(LP);
// WAREHOUSE_STAFF: lấy hàng + đóng gói (READ/UPDATE) + xếp xe / bàn giao.
const FLOOR_WORK = [...PICKING, ...PACKING_WORK, ...DISPATCH, ...LOAD_PLAN_ALL];
// WAREHOUSE_MANAGER: toàn bộ nhóm kho + gán / giám sát task, kiểm tra lại thiết kế, hãng, huỷ chuyến,
// ghi nhận hàng hoàn (delivery-outcomes:UPDATE, không có APPROVE).
const MANAGER_WORK = [
  ...PICKING,
  ...PACKING_ALL,
  ...DISPATCH,
  ...TA,
  ...OVERSIGHT,
  ...REVERIFY,
  ...CARRIER,
  ...LOAD_CANCEL,
  ...VEHICLE_TYPE_ALL,
  ...LOAD_ESTIMATE,
  ...LOAD_PLAN_ALL,
  OUTCOME.update,
];
// ORDER_COORDINATOR: gán / giám sát task + ghi nhận kết quả giao (đã giao / thất bại cần APPROVE).
const COORDINATOR_WORK = [
  ...TA,
  ...OVERSIGHT,
  ...Object.values(OUTCOME),
  ...VEHICLE_TYPE_READ,
  ...LOAD_ESTIMATE,
  ...LOAD_PLAN_READ,
];
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
const FULFILLMENT_READ = [...Object.values(PICK), ...Object.values(PACK)];
// Seed V20260928006000: warehouse-warehouses READ (danh mục kho) cho WAREHOUSE_MANAGER / STAFF,
// INVENTORY_PLANNER, PROCUREMENT_STAFF; V20261017000800 thêm SALES_STAFF — không có QC_STAFF.
const WAREHOUSE_READ = WAREHOUSE_PERMISSIONS.read;
// Seed BE V20260928006000 (BE PR #119): hồ sơ hàng tồn — WAREHOUSE_MANAGER / INVENTORY_PLANNER mọi
// quyền, WAREHOUSE_STAFF / PROCUREMENT_STAFF chỉ VIEW_PAGE + READ; role catalog không có.
const ITEM = INVENTORY_ITEM_PERMISSIONS;
const ITEM_READ = [ITEM.viewPage, ITEM.read];
const ITEM_ALL = Object.values(ITEM);
// Seed BE V20261017000510 (catalog-customer-prices): ECOMMERCE_ADMIN đủ quyền, SALES_STAFF VIEW_PAGE + READ,
// ORDER_COORDINATOR chỉ READ (không VIEW_PAGE — khoảng trống của seed BE, giữ nguyên ở mock). Seed
// V20260919001600: customer-customers cho ECOMMERCE_ADMIN / SALES_STAFF — FE chỉ dùng READ (ô chọn khách).
// Chỉ cấp mã FE khai báo (DELETE của BE chưa dùng ở FE).
const CP = CUSTOMER_PRICE_PERMISSIONS;
const CUSTOMER_PRICE_ALL = Object.values(CP);
const CUSTOMER_PRICE_READ = [CP.viewPage, CP.read];
const CUSTOMER_LOOKUP = CUSTOMER_PERMISSIONS.read;
const WH_WORK = [
  ...GR_WORK,
  ...FULFILLMENT_READ,
  ...FLOOR_WORK,
  ...INVENTORY_FLOOR,
  ...OVERVIEW_ALL,
  WAREHOUSE_READ,
  WAREHOUSE_LOCATION_PERMISSIONS.read,
  ...ITEM_READ,
  ...VEHICLE_TYPE_READ,
];

/** Explicit demo session responses keyed by existing staff IDs, never computed from roles. */
export const MOCK_USER_GRANTS: Record<string, readonly PermissionCode[]> = {
  "USER-ADMIN-01": [
    ...Object.values(SUPPLIER_PERMISSIONS),
    ...Object.values(SUPPLIER_ITEM_PERMISSIONS),
    ...Object.values(PO_PERMISSIONS),
    ...Object.values(ORDER_PERMISSIONS),
    ...Object.values(REPORTING_PERMISSIONS),
    ...Object.values(PRODUCT_PERMISSIONS),
    ...PRODUCT_STRUCTURE,
    ...Object.values(IDENTITY_PERMISSIONS),
    ...Object.values(GR),
    ...Object.values(QC),
    ...FULFILLMENT_READ,
    ...MANAGER_WORK,
    ...Object.values(OUTCOME),
    ...INVENTORY_ALL,
    ...OVERVIEW_ALL,
    WAREHOUSE_READ,
    WAREHOUSE_LOCATION_PERMISSIONS.read,
    ...Object.values(TO),
    ...SHIP,
    ...ITEM_ALL,
    ...CUSTOMER_PRICE_ALL,
    CUSTOMER_LOOKUP,
  ],
  "USER-PROC-01": [
    SUPPLIER_PERMISSIONS.viewPage,
    SUPPLIER_PERMISSIONS.read,
    SUPPLIER_PERMISSIONS.create,
    SUPPLIER_PERMISSIONS.update,
    SUPPLIER_PERMISSIONS.export,
    // Seed BE: chỉ PROCUREMENT_STAFF có procurement-supplier-items (đủ 5 action).
    ...Object.values(SUPPLIER_ITEM_PERMISSIONS),
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
    // QC_STAFF: chỉ kiểm tra lại thiết kế (BE PR #148) + đọc task / artifact
    PICK.read,
    PACK.read,
    ...REVERIFY,
  ],
  // ACCOUNTANT: xem danh sách / chi tiết đơn (BE PR #148 "ACCREAD"); KHÔNG có hàng chờ yêu cầu huỷ
  "USER-ACC-01": [
    SUPPLIER_PERMISSIONS.viewPage,
    SUPPLIER_PERMISSIONS.read,
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
  ],
  // ECOMMERCE_ADMIN: duyệt / xuất bản nhưng không tạm ngưng / ngừng kinh doanh (product-lifecycle chỉ
  // System Admin, BE PR #123)
  "USER-ECAD-01": [
    ...Object.values(PRODUCT_PERMISSIONS).filter((code) => code !== PRODUCT_PERMISSIONS.lifecycle),
    ...PRODUCT_STRUCTURE,
    ...Object.values(SUPPLIER_PERMISSIONS),
    ...CUSTOMER_PRICE_ALL,
    CUSTOMER_LOOKUP,
  ],
  "USER-SALE-01": [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.cancel,
    // Seed BE: SALES_STAFF + SYSTEM_ADMIN (không phải ORDER_COORDINATOR) quyết đơn có giao một phần không
    ORDER_PERMISSIONS.partialShipment,
    WAREHOUSE_READ,
    ...CUSTOMER_PRICE_READ,
    CUSTOMER_LOOKUP,
  ],
  "USER-SALE-02": [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.cancel,
    // Seed BE: SALES_STAFF + SYSTEM_ADMIN (không phải ORDER_COORDINATOR) quyết đơn có giao một phần không
    ORDER_PERMISSIONS.partialShipment,
    WAREHOUSE_READ,
    ...CUSTOMER_PRICE_READ,
    CUSTOMER_LOOKUP,
  ],
  "USER-SALE-03": [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.cancel,
    // Seed BE: SALES_STAFF + SYSTEM_ADMIN (không phải ORDER_COORDINATOR) quyết đơn có giao một phần không
    ORDER_PERMISSIONS.partialShipment,
    WAREHOUSE_READ,
    ...CUSTOMER_PRICE_READ,
    CUSTOMER_LOOKUP,
  ],
  // Seed BE: SALES_STAFF có sales-order-cancellations:UPDATE (huỷ đơn, đóng phần còn lại) nhưng không có APPROVE
  // (giữ / gỡ giữ / ghi giao thất bại là của ORDER_COORDINATOR)
  // Order Coordinator + Warehouse Staff → thêm quyền kho xuất của WAREHOUSE_STAFF
  "USER-COORD-01": [
    ...Object.values(ORDER_PERMISSIONS).filter(
      (code) => code !== ORDER_PERMISSIONS.partialShipment,
    ),
    ...FULFILLMENT_READ,
    ...COORDINATOR_WORK,
    ...FLOOR_WORK,
    ...INVENTORY_FLOOR,
    ...OVERVIEW_ALL,
    WAREHOUSE_READ,
    ...TO_STAFF,
    ...SHIP,
    ...ITEM_READ,
    // ORDER_COORDINATOR: chỉ READ — không VIEW_PAGE / customer-customers:READ nên không vào được màn bảng giá
    CP.read,
  ],
};

/** Tập mã quyền của một tài khoản demo (rỗng khi không biết userId). */
export function mockGrantsOf(userId: string): ReadonlySet<PermissionCode> {
  return new Set(MOCK_USER_GRANTS[userId] ?? []);
}
