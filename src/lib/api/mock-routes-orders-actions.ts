/**
 * Mock routes — thao tác điều phối đơn: credit hold (SCRUM-427), Đơn sản xuất của đơn
 * (`GET /production-orders`, khớp hợp đồng BE ProductionOrderController#list, docs 17 §4.3). Release (SCRUM-423):
 * `mock-routes-order-delivery-mode.ts` (PR #74).
 *
 * Thứ tự kiểm + mã lỗi chép theo BE develop: CreditHoldService.
 */

import { paginatePage, registerMockRoute } from "./mock-adapter";
import { mockWarehouseNames } from "./mock-display-names";
import { MOCK_WAREHOUSE_ID, productionCartonsOf } from "./mock-routes-goods-receipts-store";
import {
  MOCK_CREDIT_LIMIT,
  applyTransition,
  backendStatus,
  creditProfileOf,
  error,
  findOrder,
  holdOf,
  idParam,
  isCreditHold,
  isCustomLine,
  mockCustomerUuid,
  ok,
  paymentTermOf,
  readBody,
  readParams,
  toOrderResponse,
} from "./mock-routes-orders-store";

import type { ProductionOrderStatus } from "@/constants/orders";
import type { Order } from "@/lib/mock-data";

/**
 * Đơn công nợ còn tính vào dư nợ: không huỷ, và không phải đơn đang chờ quyết định công nợ (BE
 * `CreditChecks#undeliveredCreditExposure` bỏ giữ CREDIT — chưa phải tín dụng đã cấp). Đơn công nợ bị
 * giữ vì lý do khác (ADDRESS…) vẫn tính (BE `OrderStatus#countsTowardCreditExposure`: ON_HOLD).
 */
function countsTowardExposure(order: Order): boolean {
  return (
    paymentTermOf(order) === "CREDIT" &&
    backendStatus(order) !== "CANCELLED" &&
    !isCreditHold(order)
  );
}

/** Dư nợ của khách = tổng phần chưa thu của các đơn công nợ khác còn hiệu lực. */
async function exposureOf(order: Order): Promise<number> {
  const { orders } = await import("@/lib/mock-data");
  return orders
    .filter((o) => o.orderId !== order.orderId && o.customerId === order.customerId)
    .filter(countsTowardExposure)
    .reduce((sum, o) => sum + Math.max(0, o.grandTotal - o.amountPaid), 0);
}

/**
 * BE `CreditHoldService#position`: dư nợ = đơn công nợ chưa giao (bỏ đơn đang chờ quyết định công
 * nợ — chưa phải tín dụng đã cấp) + phải thu còn mở; còn lại = hạn mức − dư nợ, không âm.
 */
async function creditPositionOf(mockCustomerId: string, currency: string) {
  const { orders } = await import("@/lib/mock-data");
  const profile = creditProfileOf(mockCustomerId);
  const allowsCredit = profile.allowedTerms.includes("CREDIT");
  const exposure = orders
    .filter((o) => o.customerId === mockCustomerId)
    .filter(countsTowardExposure)
    .reduce((sum, o) => sum + Math.max(0, o.grandTotal - o.amountPaid), 0);
  // BE CreditPositionResponse (origin/develop 438fe6fb): không còn điều khoản thanh toán; null bị bỏ.
  return {
    customerId: mockCustomerUuid(mockCustomerId),
    creditLimit: allowsCredit ? MOCK_CREDIT_LIMIT : null,
    creditTermDays: allowsCredit ? 30 : null,
    exposure,
    availableCredit: allowsCredit ? Math.max(0, MOCK_CREDIT_LIMIT - exposure) : null,
    currency,
    hasOverdue: profile.hasOverdue,
    overdueAmount: 0,
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readNote(body: Record<string, unknown>): string {
  return typeof body.note === "string" ? body.note.trim() : "";
}

const NOTE_REQUIRED = [{ field: "note", message: "note is required", code: "NotBlank" }];
function registerCreditRoutes(): void {
  // GET /orders/credit-position/:id — CreditHoldController#position (customer-credit-profiles:READ)
  registerMockRoute("GET", "/orders/credit-position/:id", async (config) => {
    const id = idParam(config);
    // BE bind `@PathVariable UUID` → không phải UUID = 400 UNSUPPORTED_PARAMETER
    if (!UUID_PATTERN.test(id)) {
      return error(400, "UNSUPPORTED_PARAMETER", "Unsupported parameter", [
        { field: "customerId", message: "must be UUID" },
      ]);
    }
    const { orders } = await import("@/lib/mock-data");
    const owner = orders.find((o) => o.customerId && mockCustomerUuid(o.customerId) === id);
    if (!owner?.customerId) return error(404, "CUSTOMER_NOT_FOUND", "Customer not found");
    return ok(await creditPositionOf(owner.customerId, owner.currency));
  });

  // GET /orders/credit-holds — cũ nhất trước, không lọc (CreditHoldController#list)
  registerMockRoute("GET", "/orders/credit-holds", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const params = readParams(config);
    const page = Math.max(0, Number(params.get("page")) || 0);
    const size = Math.max(1, Number(params.get("size")) || 20);
    const held = orders
      .filter(isCreditHold)
      .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());
    const items = await Promise.all(
      held.map(async (order) => ({
        order: toOrderResponse(order),
        checkedAt: order.placedAt,
        creditLimit: MOCK_CREDIT_LIMIT,
        exposure: await exposureOf(order),
        orderAmount: order.grandTotal,
      })),
    );
    return ok(paginatePage(items, page, size));
  });

  registerMockRoute("POST", "/orders/:id/credit-approval", async (config) => {
    const order = await findOrder(idParam(config));
    if (!order) return error(404, "NOT_FOUND", "Resource not found");
    const note = readNote(readBody(config));
    if (!note) return error(400, "VALIDATION_FAILED", "Invalid request data", NOTE_REQUIRED);
    if (!isCreditHold(order)) {
      return error(409, "ORDER_NOT_ON_CREDIT_HOLD", "Order is not held over its credit limit");
    }
    // BE Order#approveCredit: lý do bước lịch sử = "CREDIT_APPROVED" (ghi chú lưu ở order_credit_check)
    applyTransition(order, "CONFIRMED", "CREDIT_APPROVED");
    return ok(toOrderResponse(order));
  });

  registerMockRoute("POST", "/orders/:id/credit-rejection", async (config) => {
    const order = await findOrder(idParam(config));
    if (!order) return error(404, "NOT_FOUND", "Resource not found");
    const note = readNote(readBody(config));
    if (!note) return error(400, "VALIDATION_FAILED", "Invalid request data", NOTE_REQUIRED);
    if (!isCreditHold(order)) {
      return error(409, "ORDER_NOT_ON_CREDIT_HOLD", "Order is not held over its credit limit");
    }
    // BE CreditHoldService#refuse (CreditRefusalRequest {note}): từ chối luôn huỷ đơn — CREDIT_REJECTED
    applyTransition(order, "CANCELLED", `CREDIT_REJECTED: ${note}`, {
      cancellation: {
        reasonCode: "CREDIT_REJECTED",
        reason: `CREDIT_REJECTED: ${note}`,
        retainedAmount: 0,
        feeReason: null,
        feeDetail: null,
        feeAmount: null,
      },
    });
    return ok(toOrderResponse(order));
  });
}

/**
 * Trạng thái Đơn sản xuất suy từ trạng thái đơn bán (docs 17 §4.2 bước 5–6, §5.3). Đơn ON_HOLD theo trạng thái đã bị
 * giữ (giữ công nợ: chưa release → chưa có Đơn sản xuất). Hàng đã về kho đủ khi đơn đã qua sản xuất.
 */
function productionStatusFor(order: Order): ProductionOrderStatus | null {
  const status = backendStatus(order);
  const effective = status === "ON_HOLD" ? holdOf(order)?.statusBeforeHold : status;
  switch (effective) {
    case "IN_PRODUCTION":
      return "IN_PRODUCTION";
    case "READY_TO_FULFILL":
    case "PICKING":
    case "PARTIALLY_FULFILLED":
    case "PACKED":
    case "SHIPPED":
    case "DELIVERY_FAILED":
    case "DELIVERED":
    case "RETURN_REQUESTED":
    case "RETURNED":
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
    case "COMPLETED":
    case "CLOSED":
      return "RECEIVED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return null;
  }
}

/** `PRD-yyyyMMdd-NNNN` như BE `ProductionOrderRepositoryAdapter#nextCode` — ngày đặt đơn + số thứ tự (mock-only). */
function productionCode(order: Order, seq: number): string {
  const day = order.placedAt.slice(0, 10).replaceAll("-", "");
  return `PRD-${day}-${String(seq).padStart(4, "0")}`;
}

const LEGACY_HCM = "WH-HCM-01";

/** Bỏ trường null — BE `non_null` không gửi chúng. */
function withoutNulls(fields: Record<string, string | null>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string] => entry[1] !== null),
  );
}

/**
 * Đơn sản xuất mock của một đơn bán (BE `ProductionOrderResponse`). ASSUMPTION (mock-only): đơn mock có một đợt giao →
 * một Đơn sản xuất gồm mọi dòng tuỳ chỉnh; dòng mock không đặt theo thùng nên coi như 1 cái / thùng. Số thùng đã nhận
 * cộng thêm thùng của phiếu nhập mock đã xác nhận (SCRUM-566) — đơn đang sản xuất chuyển Partially Received / Received.
 */
async function productionOrderOf(order: Order) {
  const base = productionStatusFor(order);
  const custom = order.lines.filter(isCustomLine);
  if (!base || custom.length === 0) return null;
  const { lines, warehouseId } = toOrderResponse(order);
  const productionLines = custom.map((line) => {
    const id = `PRD-${line.lineId}-L1`;
    const received = base === "RECEIVED" ? line.quantity : productionCartonsOf(id);
    return {
      id,
      orderLineId: line.lineId,
      sku: line.skuId,
      cartons: line.quantity,
      unitsPerCarton: 1,
      totalUnits: line.quantity,
      designSnapshotId: lines.find((l) => l.lineId === line.lineId)?.designSnapshotId ?? null,
      receivedCartons: Math.min(received, line.quantity),
    };
  });
  const receivedAny = productionLines.some((line) => line.receivedCartons > 0);
  const receivedAll = productionLines.every((line) => line.receivedCartons >= line.cartons);
  const status: ProductionOrderStatus =
    base !== "IN_PRODUCTION" || !receivedAny
      ? base
      : receivedAll
        ? "RECEIVED"
        : "PARTIALLY_RECEIVED";
  const receivingId = warehouseId === LEGACY_HCM ? MOCK_WAREHOUSE_ID : warehouseId;
  const receiving = mockWarehouseNames(receivingId);
  return {
    id: `PRD-${order.orderId}`,
    code: productionCode(order, 1),
    salesOrderId: order.orderId,
    // ASSUMPTION (mock-only): kho `WH-HCM-01` của mock-data không có khu RECEIVING — Đơn sản xuất nhận về kho HCM của
    // store module 06 (`MOCK_WAREHOUSE_ID`, có khu RCV01) để lập phiếu nhập được (docs 03 §3: khu nhận bắt buộc).
    receivingWarehouseId: receivingId,
    // #286: số đơn bán + mã / tên kho nhận kèm id (kho lạ → bỏ trường như BE `non_null`)
    salesOrderNumber: order.orderNumber,
    ...withoutNulls({
      receivingWarehouseCode: receiving.warehouseCode,
      receivingWarehouseName: receiving.warehouseName,
    }),
    status,
    needByDate: order.placedAt.slice(0, 10),
    sampleApprovalRequired: false,
    lines: productionLines,
    version: 0,
  };
}

export type MockProductionOrder = NonNullable<Awaited<ReturnType<typeof productionOrderOf>>>;

/** Mọi Đơn sản xuất mock (một đơn bán → tối đa một Đơn sản xuất). */
export async function mockProductionOrders(): Promise<MockProductionOrder[]> {
  const { orders } = await import("@/lib/mock-data");
  const rows = await Promise.all(orders.map(productionOrderOf));
  return rows.filter((row): row is MockProductionOrder => row !== null);
}

export async function findMockProductionOrder(id: string): Promise<MockProductionOrder | null> {
  return (await mockProductionOrders()).find((row) => row.id === id) ?? null;
}

function registerProductionRoute(): void {
  // GET /production-orders — BE ProductionOrderController#list: trang `PageResponse`, lọc `salesOrderId` / `status` /
  // `warehouseId`. BE không kiểm đơn tồn tại → đơn lạ trả trang rỗng, không 404.
  registerMockRoute("GET", "/production-orders", async (config) => {
    const params = readParams(config);
    const page = Math.max(0, Number(params.get("page")) || 0);
    const size = Math.max(1, Number(params.get("size")) || 20);
    const salesOrderId = params.get("salesOrderId");
    const status = params.get("status");
    const warehouseId = params.get("warehouseId");
    const rows = (await mockProductionOrders())
      .filter((row) => !salesOrderId || row.salesOrderId === salesOrderId)
      .filter((row) => !status || row.status === status)
      .filter((row) => !warehouseId || row.receivingWarehouseId === warehouseId);
    return ok(paginatePage(rows, page, size));
  });

  // GET /production-orders/{id} — BE ProductionOrderController#one
  registerMockRoute("GET", "/production-orders/:id", async (config) => {
    const id = idParam(config);
    const row = await findMockProductionOrder(id);
    return row ? ok(row) : error(404, "PRODUCTION_ORDER_NOT_FOUND", `No production order ${id}`);
  });
}

export function registerOrderActionMockRoutes(): void {
  registerCreditRoutes();
  registerProductionRoute();
}
