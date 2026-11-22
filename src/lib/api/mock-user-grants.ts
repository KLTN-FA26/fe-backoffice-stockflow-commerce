/**
 * Quyền của từng tài khoản demo (USE_MOCK=true) — dùng chung cho BFF mock (`/identity/me/permissions`,
 * server) và mock backend phía client (`lib/api/mock-routes-*`, cổng quyền thay `@RequiresPermission`).
 * Không import `server-only` để mock backend đọc được. Tính theo userId, KHÔNG suy từ tên vai trò.
 */

import {
  ATTRIBUTE_PERMISSIONS,
  CHAT_PERMISSIONS,
  CUSTOMIZATION_TEMPLATE_PERMISSIONS,
  CREDIT_HOLD_PERMISSIONS,
  CUSTOMER_CREDIT_PROFILE_PERMISSIONS,
  CUSTOMER_LEGAL_PROFILE_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  CUSTOMER_PRICE_PERMISSIONS,
  FULFILLMENT_CARRIER_EVENT_PERMISSIONS,
  FULFILLMENT_CARRIER_PERMISSIONS,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS,
  FULFILLMENT_WAYBILL_CORRECTION_PERMISSIONS,
  FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS,
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
  CYCLE_COUNT_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  LOAD_ESTIMATE_PERMISSIONS,
  LOAD_PLAN_PERMISSIONS,
  ORDER_PERMISSIONS,
  ORDER_DELIVERY_BATCH_PERMISSIONS,
  ORDER_SHIPPING_WAREHOUSE_PERMISSIONS,
  SALES_CONTRACT_PERMISSIONS,
  CANCELLATION_REQUEST_PERMISSIONS,
  PAYMENT_REFUND_PERMISSIONS,
  PO_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  PRODUCTION_ORDER_PERMISSIONS,
  PUTAWAY_TASK_PERMISSIONS,
  PUTAWAY_TRIP_PERMISSIONS,
  QC_TASK_PERMISSIONS,
  QUOTE_PERMISSIONS,
  REPORTING_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  STOCK_PACKAGE_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
  VARIANT_PERMISSIONS,
  VEHICLE_TYPE_PERMISSIONS,
  WAREHOUSE_LOCATION_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants/permissions";
import { EINVOICE_PERMISSIONS, EINVOICE_SETTINGS_PERMISSIONS } from "@/constants/einvoice";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_RECEIPT_PERMISSIONS } from "@/constants/payment";

import type { PermissionCode } from "@/lib/auth/me-permissions";

// Seed BE V20260903000100: goods-receipts VIEW_PAGE/READ/CREATE/UPDATE cho WAREHOUSE_STAFF,
// WAREHOUSE_MANAGER, PROCUREMENT_STAFF; QC_STAFF chỉ VIEW_PAGE/READ + qc-tasks:APPROVE.
// WAREHOUSE_STAFF KHÔNG có purchase-orders:READ (đã chốt giữ nguyên seed, SCRUM-436).
const GR = GOODS_RECEIPT_PERMISSIONS;
const QC = QC_TASK_PERMISSIONS;
const GR_WORK = [GR.viewPage, GR.read, GR.create, GR.update];
// fulfillment-shipments VIEW_PAGE/READ cho WAREHOUSE_STAFF / MANAGER / ORDER_COORDINATOR (ghi đã tách ra
// các resource fulfillment-dispatch / -carriers / -load-cancellations / -delivery-outcomes, BE PR #148).
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
const DISPATCH = Object.values(FULFILLMENT_DISPATCH_PERMISSIONS);
// V20261108001400 / 001500: sửa mã vận đơn sau khi rời kho (quản lý kho) và nhập mã vận đơn từ file (nhân viên kho + quản lý kho)
const WAYBILL_CORRECTION = Object.values(FULFILLMENT_WAYBILL_CORRECTION_PERMISSIONS);
const WAYBILL_IMPORT = Object.values(FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS);
// Seed BE V20261029007100 (SCRUM-474 UNLOAD-DESIGN): huỷ có kiểm soát + xác nhận dỡ kiện không quét — chỉ quản lý kho.
const CONTROLLED_CANCEL = Object.values(FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS);
const CARRIER = Object.values(FULFILLMENT_CARRIER_PERMISSIONS);
// Seed BE: sự kiện hãng vận chuyển (READ + UPDATE) — quản lý kho, hệ thống
const CARRIER_EVENT = Object.values(FULFILLMENT_CARRIER_EVENT_PERMISSIONS);
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
// Seed BE (baseline + V20261124000100): warehouse-putaway-tasks VIEW_PAGE/READ/UPDATE và warehouse-putaway-trips
// VIEW_PAGE/READ/UPDATE cho WAREHOUSE_STAFF; APPROVE của chuyến (đóng chuyến người khác) chỉ WAREHOUSE_MANAGER /
// SYSTEM_ADMIN (docs 05 §2).
const PUTAWAY_TASKS = Object.values(PUTAWAY_TASK_PERMISSIONS);
const PUTAWAY_FLOOR = [
  ...PUTAWAY_TASKS,
  PUTAWAY_TRIP_PERMISSIONS.viewPage,
  PUTAWAY_TRIP_PERMISSIONS.read,
  PUTAWAY_TRIP_PERMISSIONS.update,
];
const PUTAWAY_ALL = [...PUTAWAY_TASKS, ...Object.values(PUTAWAY_TRIP_PERMISSIONS)];
// WAREHOUSE_STAFF: lấy hàng + đóng gói (READ/UPDATE) + xếp xe / bàn giao + cất hàng.
const FLOOR_WORK = [
  ...PICKING,
  ...PACKING_WORK,
  ...DISPATCH,
  ...WAYBILL_IMPORT,
  ...LOAD_PLAN_ALL,
  ...PUTAWAY_FLOOR,
];
// WAREHOUSE_MANAGER: toàn bộ nhóm kho + gán / giám sát task, kiểm tra lại thiết kế, hãng, sửa mã vận đơn,
// ghi nhận hàng hoàn (delivery-outcomes:UPDATE, không có APPROVE).
const MANAGER_WORK = [
  ...PICKING,
  ...PACKING_ALL,
  ...DISPATCH,
  ...TA,
  ...OVERSIGHT,
  ...CARRIER,
  ...CARRIER_EVENT,
  ...WAYBILL_CORRECTION,
  ...WAYBILL_IMPORT,
  ...CONTROLLED_CANCEL,
  ...VEHICLE_TYPE_ALL,
  ...LOAD_ESTIMATE,
  ...LOAD_PLAN_ALL,
  ...PUTAWAY_ALL,
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
// Seed BE: WAREHOUSE_STAFF / INVENTORY_PLANNER giữ inventory-stock-items:READ/UPDATE; WAREHOUSE_STAFF thêm warehouse-locations:READ (V20260928006000).
// Sổ kho + phiếu điều chỉnh: VIEW_PAGE + READ cho WAREHOUSE_STAFF (V20261013000200) và INVENTORY_PLANNER
// (sổ kho V20260903000100, phiếu điều chỉnh V20261014001200).
const INVENTORY_FLOOR = [
  INV.adjustmentViewPage,
  INV.adjustmentRead,
  INV.movementViewPage,
  INV.stockUpdate,
  INV.stockRead,
  INV.movementRead,
];
const INVENTORY_ALL = Object.values(INV);
// Seed BE V20260903000100 / V20261023000300 / V20261028001000: WAREHOUSE_MANAGER đủ quyền phiếu kiểm kê
// (`inventory-cycle-counts`); WAREHOUSE_STAFF xem + đếm (VIEW_PAGE, READ, UPDATE), không lập / duyệt.
const CC = CYCLE_COUNT_PERMISSIONS;
const CYCLE_COUNT_ALL = Object.values(CC);
const CYCLE_COUNT_COUNTER = [CC.viewPage, CC.read, CC.update];
// Seed BE V20260903000100: WAREHOUSE_STAFF / MANAGER đọc tồn + giữ chỗ; INVENTORY_PLANNER và
// QC_STAFF chỉ đọc tồn (inventory-stock-items VIEW_PAGE/READ).
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
// Seed BE V20261020000700 (SCRUM-473): thùng có LPN — WAREHOUSE_MANAGER mọi quyền, WAREHOUSE_STAFF xem + in / in
// lại nhãn (VIEW_PAGE, READ, CREATE), INVENTORY_PLANNER / QC_STAFF chỉ xem.
const SP = STOCK_PACKAGE_PERMISSIONS;
const STOCK_PACKAGE_READ = [SP.viewPage, SP.read];
const STOCK_PACKAGE_STAFF = [...STOCK_PACKAGE_READ, SP.create];
const STOCK_PACKAGE_ALL = Object.values(SP);
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
  ...CYCLE_COUNT_COUNTER,
  ...OVERVIEW_ALL,
  WAREHOUSE_READ,
  WAREHOUSE_LOCATION_PERMISSIONS.read,
  // Seed V20260928006000: WAREHOUSE_STAFF xem trang danh mục kho + bản đồ (VIEW_PAGE, READ), không sửa
  WAREHOUSE_PERMISSIONS.viewPage,
  WAREHOUSE_LOCATION_PERMISSIONS.viewPage,
  ...ITEM_READ,
  ...VEHICLE_TYPE_READ,
  ...STOCK_PACKAGE_STAFF,
];

// Seed BE develop (đơn bán, SCRUM-427 / SCRUM-440):
// - V20261013000400: sales-order-credit-holds APPROVE chỉ ACCOUNTANT; Sales/Coordinator chỉ xem.
// - V20261013000400: customer-credit-profiles READ cho ACCOUNTANT / SALES_STAFF / ORDER_COORDINATOR
//   (FE chỉ dùng READ — `GET /orders/credit-position/{customerId}`).
// - V20261010000500: production-orders READ cho SALES_STAFF / ORDER_COORDINATOR (không ACCOUNTANT) —
//   FE chỉ dùng để xem LSX trên trang chi tiết đơn.
const CREDIT_VIEW = [CREDIT_HOLD_PERMISSIONS.viewPage, CREDIT_HOLD_PERMISSIONS.read];
const CREDIT_ALL = Object.values(CREDIT_HOLD_PERMISSIONS);
const CREDIT_PROFILE_READ = CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read;
const PRODUCTION_READ = PRODUCTION_ORDER_PERMISSIONS.read;
// Seed BE (V20261108002200): sales-contracts:READ cho SALES_STAFF / SALES_MANAGER / ACCOUNTANT / SYSTEM_ADMIN — không có
// quản lý kho. Từ BE PR #317 (V20261124000650) lịch giao (`GET /orders/{id}/delivery-batches`, ô chọn đợt ở hộp thoại
// release + panel lịch giao) là `sales-order-delivery-batches:READ`: cấp cho mọi vai có sales-contracts:READ và mọi vai
// release (`sales-order-releases:UPDATE`, quản lý kho) — nên đi cùng CONTRACT_READ ở các vai bên dưới.
const CONTRACT_READ = SALES_CONTRACT_PERMISSIONS.read;
const DELIVERY_SCHEDULE_READ = ORDER_DELIVERY_BATCH_PERMISSIONS.read;
const ORDER_SALES_EXTRA = [
  ...CREDIT_VIEW,
  CREDIT_PROFILE_READ,
  PRODUCTION_READ,
  CONTRACT_READ,
  DELIVERY_SCHEDULE_READ,
];
// Seed BE (PermissionMatrixTest, WF4 ngoại lệ): SALES_STAFF + SYSTEM_ADMIN có hàng đợi yêu cầu huỷ (`sales-order-
// cancellations:READ`) và dời cửa sổ giao (`sales-contracts:UPDATE`, docs 17 BR-28 "chỉ Sale"); `payment-refunds:READ` còn
// cho ACCOUNTANT / SALES_MANAGER (đọc kết quả tất toán sau huỷ).
const CANCELLATION_QUEUE_READ = CANCELLATION_REQUEST_PERMISSIONS.read;
const CONTRACT_UPDATE = SALES_CONTRACT_PERMISSIONS.update;
const REFUND_READ = PAYMENT_REFUND_PERMISSIONS.read;
// Seed BE (PermissionMatrixTest, 4B-7; docs 17 §4.2 bước 2): `sales-order-shipping-warehouses:UPDATE` (Sale chọn kho xuất và giữ
// hàng) chỉ SALES_STAFF + SYSTEM_ADMIN; READ còn cho SALES_MANAGER / WAREHOUSE_MANAGER / PRODUCTION_COORDINATOR.
const SHIPPING_WAREHOUSE_ALL = Object.values(ORDER_SHIPPING_WAREHOUSE_PERMISSIONS);
const SALES_WF4_EXTRA = [
  CANCELLATION_QUEUE_READ,
  CONTRACT_UPDATE,
  REFUND_READ,
  ...SHIPPING_WAREHOUSE_ALL,
];

// Seed BE V20261108002400 + V20261108003000 (thanh toán theo hợp đồng, docs 15): ACCOUNTANT và SYSTEM_ADMIN —
// đợt VIEW_PAGE + READ, phiếu thu và hoàn tiền đủ 4 action (lập / huỷ); SALES_STAFF — đợt và hoàn tiền chỉ
// VIEW_PAGE + READ (gửi thông tin chuyển khoản, nhắc nợ, theo dõi hoàn), không có phiếu thu.
const PAY_INSTALLMENT_READ = [
  PAYMENT_INSTALLMENT_PERMISSIONS.viewPage,
  PAYMENT_INSTALLMENT_PERMISSIONS.read,
];
const PAY_REFUND_READ = [PAYMENT_REFUND_PERMISSIONS.viewPage, PAYMENT_REFUND_PERMISSIONS.read];
const PAY_ACCOUNTANT = [
  ...PAY_INSTALLMENT_READ,
  ...Object.values(PAYMENT_RECEIPT_PERMISSIONS),
  ...Object.values(PAYMENT_REFUND_PERMISSIONS),
];
const PAY_SALES = [...PAY_INSTALLMENT_READ, ...PAY_REFUND_READ];

// Seed BE V20261120000300 (hoá đơn điện tử, docs 21): ACCOUNTANT và SYSTEM_ADMIN đủ 6 action `einvoices`;
// cấu hình: ACCOUNTANT chỉ READ, SYSTEM_ADMIN READ + UPDATE; SALES_MANAGER chỉ VIEW_PAGE + READ hoá đơn.
const EINVOICE_ALL = Object.values(EINVOICE_PERMISSIONS);
const EINVOICE_SETTINGS_ALL = Object.values(EINVOICE_SETTINGS_PERMISSIONS);

// Seed BE V20261124000300 (chat, docs 16): chat-conversations đủ action cho SALES_STAFF / SALES_MANAGER / SYSTEM_ADMIN,
// chat-canned-responses cho cả ba; chat-supervision (giao hội thoại chưa ai nhận, xử lý hội thoại đã chuyển cấp) chỉ
// SALES_MANAGER / SYSTEM_ADMIN.
const CHAT_AGENT = Object.values(CHAT_PERMISSIONS).filter(
  (code) => code !== CHAT_PERMISSIONS.supervise && code !== CHAT_PERMISSIONS.superviseRead,
);
const CHAT_ALL = Object.values(CHAT_PERMISSIONS);

// WF-02 (docs 14 §2; BE PermissionMatrixTest): Sale lập / sửa / gửi / huỷ báo giá và tạo đơn từ báo giá; lập, gửi, ghi
// nhận đã ký hợp đồng (`sales-contracts:CREATE/UPDATE/APPROVE` — SALES_STAFF + SYSTEM_ADMIN). Chấp nhận / yêu cầu sửa
// báo giá (`sales-quotes:APPROVE`) là việc của khách, không cấp cho nhân viên.
const QUOTE_SALES = Object.values(QUOTE_PERMISSIONS).filter(
  (code) => code !== QUOTE_PERMISSIONS.approve,
);
const CONTRACT_SALES = [SALES_CONTRACT_PERMISSIONS.create, SALES_CONTRACT_PERMISSIONS.approve];
// Hồ sơ pháp lý của khách (seed V20261120000100): SALES_STAFF, SALES_MANAGER, ACCOUNTANT, SYSTEM_ADMIN đều READ + UPDATE.
const LEGAL_PROFILE_ALL = Object.values(CUSTOMER_LEGAL_PROFILE_PERMISSIONS);
const SALES_WF02 = [...QUOTE_SALES, ...CONTRACT_SALES, ...LEGAL_PROFILE_ALL];

/** Explicit demo session responses keyed by existing staff IDs, never computed from roles. */
export const MOCK_USER_GRANTS: Record<string, readonly PermissionCode[]> = {
  "USER-ADMIN-01": [
    ...Object.values(SUPPLIER_PERMISSIONS),
    ...Object.values(PO_PERMISSIONS),
    ...Object.values(ORDER_PERMISSIONS),
    ...CREDIT_ALL,
    CREDIT_PROFILE_READ,
    PRODUCTION_READ,
    CONTRACT_READ,
    DELIVERY_SCHEDULE_READ,
    ...SALES_WF4_EXTRA,
    ...Object.values(REPORTING_PERMISSIONS),
    ...Object.values(PRODUCT_PERMISSIONS),
    ...PRODUCT_STRUCTURE,
    // BE `CustomizationTemplateController`: SALES_MANAGER và SYSTEM_ADMIN (mock admin là System Admin); không có
    // SALES_STAFF (chủ dự án xác nhận) và ECOMMERCE_ADMIN không được ghi nhận là có.
    ...Object.values(CUSTOMIZATION_TEMPLATE_PERMISSIONS),
    ...Object.values(IDENTITY_PERMISSIONS),
    ...Object.values(GR),
    ...Object.values(QC),
    ...FULFILLMENT_READ,
    ...MANAGER_WORK,
    ...Object.values(OUTCOME),
    ...INVENTORY_ALL,
    ...CYCLE_COUNT_ALL,
    ...OVERVIEW_ALL,
    // Seed V20260903000100 / V20260928006000: WAREHOUSE_MANAGER đủ quyền danh mục kho và bản đồ kho
    ...Object.values(WAREHOUSE_PERMISSIONS),
    ...Object.values(WAREHOUSE_LOCATION_PERMISSIONS),
    ...SHIP,
    ...ITEM_ALL,
    ...CUSTOMER_PRICE_ALL,
    CUSTOMER_LOOKUP,
    ...STOCK_PACKAGE_ALL,
    ...PAY_ACCOUNTANT,
    ...EINVOICE_ALL,
    ...EINVOICE_SETTINGS_ALL,
    ...CHAT_ALL,
    ...SALES_WF02,
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
    WAREHOUSE_READ,
    ...ITEM_ALL,
    ...STOCK_PACKAGE_READ,
  ],
  // Existing USER-ADMIN-01 is also the only Warehouse Manager; WH users are staff.
  "USER-WH-01": [...WH_WORK, ...SHIP],
  "USER-WH-02": [...WH_WORK, ...SHIP],
  "USER-WH-03": [...WH_WORK, ...SHIP],
  "USER-WH-04": [...WH_WORK, ...SHIP],
  "USER-QC-01": [
    GR.viewPage,
    GR.read,
    QC.viewPage,
    QC.read,
    QC.approve,
    ...STOCK_READ,
    ...STOCK_PACKAGE_READ,
    // QC_STAFF: đọc task / artifact (BE đã bỏ bước kiểm tra thiết kế lúc đóng gói)
    PICK.read,
    PACK.read,
  ],
  // ACCOUNTANT: xem danh sách / chi tiết đơn (BE PR #148 "ACCREAD"); KHÔNG có hàng chờ yêu cầu huỷ
  "USER-ACC-01": [
    SUPPLIER_PERMISSIONS.viewPage,
    SUPPLIER_PERMISSIONS.read,
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    // SCRUM-427: duyệt / từ chối vượt hạn mức công nợ
    ...CREDIT_ALL,
    CREDIT_PROFILE_READ,
    ...LEGAL_PROFILE_ALL,
    ...PAY_ACCOUNTANT,
    CONTRACT_READ,
    DELIVERY_SCHEDULE_READ,
    REFUND_READ,
    ...EINVOICE_ALL,
    EINVOICE_SETTINGS_PERMISSIONS.read,
    // BE V20261209000200 (docs 20 §3): Kế toán xem phiếu điều chỉnh tồn — chỉ đọc, không lập / duyệt
    INVENTORY_PERMISSIONS.adjustmentViewPage,
    INVENTORY_PERMISSIONS.adjustmentRead,
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
    // Seed BE: SALES_STAFF + SYSTEM_ADMIN (không phải ORDER_COORDINATOR) giữ / gỡ giữ đơn (`sales-order-holds:UPDATE`)
    ORDER_PERMISSIONS.hold,
    // Seed BE: SALES_STAFF + SYSTEM_ADMIN (không phải ORDER_COORDINATOR) quyết đơn có giao một phần không
    ORDER_PERMISSIONS.partialShipment,
    ...ORDER_SALES_EXTRA,
    ...SALES_WF4_EXTRA,
    WAREHOUSE_READ,
    ...CUSTOMER_PRICE_READ,
    CUSTOMER_LOOKUP,
    ...PAY_SALES,
    ...CHAT_AGENT,
    ...SALES_WF02,
  ],
  "USER-SALE-02": [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.cancel,
    // Seed BE: SALES_STAFF + SYSTEM_ADMIN (không phải ORDER_COORDINATOR) giữ / gỡ giữ đơn (`sales-order-holds:UPDATE`)
    ORDER_PERMISSIONS.hold,
    // Seed BE: SALES_STAFF + SYSTEM_ADMIN (không phải ORDER_COORDINATOR) quyết đơn có giao một phần không
    ORDER_PERMISSIONS.partialShipment,
    ...ORDER_SALES_EXTRA,
    ...SALES_WF4_EXTRA,
    WAREHOUSE_READ,
    ...CUSTOMER_PRICE_READ,
    CUSTOMER_LOOKUP,
    ...PAY_SALES,
    ...CHAT_AGENT,
    ...SALES_WF02,
  ],
  "USER-SALE-03": [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.cancel,
    // Seed BE: SALES_STAFF + SYSTEM_ADMIN (không phải ORDER_COORDINATOR) giữ / gỡ giữ đơn (`sales-order-holds:UPDATE`)
    ORDER_PERMISSIONS.hold,
    // Seed BE: SALES_STAFF + SYSTEM_ADMIN (không phải ORDER_COORDINATOR) quyết đơn có giao một phần không
    ORDER_PERMISSIONS.partialShipment,
    ...ORDER_SALES_EXTRA,
    ...SALES_WF4_EXTRA,
    WAREHOUSE_READ,
    ...CUSTOMER_PRICE_READ,
    CUSTOMER_LOOKUP,
    ...PAY_SALES,
    ...CHAT_AGENT,
    ...SALES_WF02,
  ],
  // Seed BE: SALES_STAFF có sales-order-cancellations:UPDATE (huỷ đơn, đóng phần còn lại) và sales-order-holds:UPDATE
  // (giữ / gỡ giữ); ghi giao thất bại ở cấp đơn là fulfillment-delivery-outcomes:APPROVE
  // Order Coordinator + Warehouse Staff → thêm quyền kho xuất của WAREHOUSE_STAFF
  "USER-COORD-01": [
    ...Object.values(ORDER_PERMISSIONS).filter(
      (code) => code !== ORDER_PERMISSIONS.partialShipment && code !== ORDER_PERMISSIONS.hold,
    ),
    ...ORDER_SALES_EXTRA,
    ...FULFILLMENT_READ,
    ...COORDINATOR_WORK,
    ...FLOOR_WORK,
    ...INVENTORY_FLOOR,
    ...OVERVIEW_ALL,
    WAREHOUSE_READ,
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
