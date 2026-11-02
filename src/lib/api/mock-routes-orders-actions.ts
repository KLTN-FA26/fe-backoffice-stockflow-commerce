/**
 * Mock routes — thao tác điều phối đơn: credit hold (SCRUM-427), lệnh sản xuất của đơn
 * (`GET /production/orders`, khớp hợp đồng BE ProductionOrderController#list). Release (SCRUM-423):
 * `mock-routes-order-delivery-mode.ts` (PR #74).
 *
 * Thứ tự kiểm + mã lỗi chép theo BE develop: CreditHoldService.
 */

import { ORDER_LIMITS } from "@/constants";

import { paginatePage, registerMockRoute } from "./mock-adapter";
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
  return {
    customerId: mockCustomerUuid(mockCustomerId),
    allowedTerms: [...profile.allowedTerms],
    defaultTerm: profile.defaultTerm,
    depositPercent: profile.depositPercent,
    creditLimit: allowsCredit ? MOCK_CREDIT_LIMIT : null,
    creditTermDays: allowsCredit ? 30 : null,
    exposure,
    availableCredit: allowsCredit ? Math.max(0, MOCK_CREDIT_LIMIT - exposure) : null,
    currency,
    hasOverdue: profile.hasOverdue,
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readNote(body: Record<string, unknown>): string {
  return typeof body.note === "string" ? body.note.trim() : "";
}

const NOTE_REQUIRED = [{ field: "note", message: "note is required", code: "NotBlank" }];
const DEPOSIT_PERCENT_INVALID = [
  { field: "depositPercent", message: "must be between 0 and 100 (exclusive)", code: "Range" },
];
const INVALID = Symbol("invalid");

/**
 * BE CreditRefusalRequest.depositPercent: tuỳ chọn (bỏ trống = mặc định của khách), có thì
 * 0 < x < 100 (biên mở) — cùng giới hạn với `ORDER_LIMITS.depositPercent*`.
 */
function readDepositPercent(body: Record<string, unknown>): number | undefined | typeof INVALID {
  const value = body.depositPercent;
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return INVALID;
  return value > ORDER_LIMITS.depositPercentMin && value < ORDER_LIMITS.depositPercentMax
    ? value
    : INVALID;
}

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
    const body = readBody(config);
    const note = readNote(body);
    if (!note) return error(400, "VALIDATION_FAILED", "Invalid request data", NOTE_REQUIRED);
    if (!isCreditHold(order)) {
      return error(409, "ORDER_NOT_ON_CREDIT_HOLD", "Order is not held over its credit limit");
    }
    // BE CreditHoldService#refuse: chuyển sang phương thức khách không được phép → 409
    const switchTo =
      body.action === "SWITCH_TO_PREPAID"
        ? "PREPAID"
        : body.action === "SWITCH_TO_DEPOSIT"
          ? "DEPOSIT"
          : null;
    const profile = creditProfileOf(order.customerId);
    if (switchTo && !profile.allowedTerms.includes(switchTo)) {
      return error(409, "PAYMENT_TERM_NOT_ALLOWED", "This payment term is not available");
    }
    switch (body.action) {
      case "CANCEL":
        // BE Order#cancel: lý do = "CREDIT_REJECTED: ghi chú" (đơn + lịch sử)
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
        break;
      // BE Order#switchTermsAfterCreditRefusal: lý do bước lịch sử = "CREDIT_REJECTED"
      case "SWITCH_TO_PREPAID":
        applyTransition(order, "PENDING_PAYMENT", "CREDIT_REJECTED", { paymentTerm: "PREPAID" });
        break;
      case "SWITCH_TO_DEPOSIT": {
        const depositPercent = readDepositPercent(body);
        if (depositPercent === INVALID) {
          return error(400, "VALIDATION_FAILED", "Invalid request data", DEPOSIT_PERCENT_INVALID);
        }
        // Bỏ trống → % cọc mặc định của hồ sơ khách (BE `terms.depositPercent()`)
        applyTransition(order, "PENDING_PAYMENT", "CREDIT_REJECTED", {
          paymentTerm: "DEPOSIT",
          depositPercent: depositPercent ?? profile.depositPercent ?? undefined,
        });
        break;
      }
      default:
        return error(400, "MALFORMED_REQUEST", "Unknown refusal action");
    }
    return ok(toOrderResponse(order));
  });
}

/**
 * Trạng thái LSX gốc suy từ trạng thái đơn (docs 19 §5.1 + docs 17 §4.2 bước 5–6). Đơn ON_HOLD theo
 * trạng thái đã bị giữ (giữ công nợ: chưa release → chưa có LSX).
 */
function parentStatusFor(order: Order): string | null {
  const status = backendStatus(order);
  const effective = status === "ON_HOLD" ? holdOf(order)?.statusBeforeHold : status;
  switch (effective) {
    case "IN_PRODUCTION":
      return "PRINTING";
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
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return null;
  }
}

/** `LSX-yyyyMMdd-NNNN` như BE `ProductionOrder` — ngày đặt đơn + số thứ tự trong đơn (mock-only). */
function productionNumber(order: Order, seq: number): string {
  const day = order.placedAt.slice(0, 10).replaceAll("-", "");
  return `LSX-${day}-${String(seq).padStart(4, "0")}`;
}

function registerProductionRoute(): void {
  // GET /production/orders — BE ProductionOrderController#list: trang `PageResponse` của
  // ProductionOrderRowResponse. Mock chỉ hỗ trợ lọc `salesOrderId` (+ `type`) mà FE dùng; BE không
  // kiểm đơn tồn tại → đơn lạ trả trang rỗng, không 404.
  registerMockRoute("GET", "/production/orders", async (config) => {
    const params = readParams(config);
    const page = Math.max(0, Number(params.get("page")) || 0);
    const size = Math.max(1, Number(params.get("size")) || 20);
    const salesOrderId = params.get("salesOrderId");
    const types = params.getAll("type").flatMap((t) => t.split(","));
    const order = salesOrderId ? await findOrder(salesOrderId) : undefined;
    // Đơn chưa release → chưa có LSX (docs 17 §4.2 bước 5: LSX sinh khi release)
    const parentStatus = order ? parentStatusFor(order) : null;
    if (!order || !parentStatus || (types.length > 0 && !types.includes("ORDER"))) {
      return ok(paginatePage([], page, size));
    }
    const { lines, warehouseId } = toOrderResponse(order);
    let seq = 0;

    const rows = order.lines.filter(isCustomLine).flatMap((line, index) => {
      const parentId = `PRD-${line.lineId}`;
      const inProduction = parentStatus === "PRINTING";
      // ASSUMPTION (mock-only, docs 19 BR-12): dòng in đầu tiên của đơn đang sản xuất tách
      // 40% phần chưa xuất phôi sang gia công ngoài → có LSX con để demo cây gốc/con.
      const splitQty = inProduction && index === 0 ? Math.floor(line.quantity * 0.4) : 0;
      const common = {
        type: "ORDER",
        warehouseId,
        blankSku: line.skuId,
        designSnapshotId: lines.find((l) => l.lineId === line.lineId)?.designSnapshotId ?? null,
        salesOrderId: order.orderId,
        salesOrderLineId: line.lineId,
        createdAt: order.placedAt,
      };
      const parent = {
        ...common,
        id: parentId,
        orderNumber: productionNumber(order, ++seq),
        mode: "IN_HOUSE",
        status: parentStatus,
        plannedQuantity: line.quantity - splitQty,
        goodQuantity: parentStatus === "COMPLETED" ? line.quantity - splitQty : 0,
      };
      if (!splitQty) return [parent];
      return [
        parent,
        {
          ...common,
          id: `${parentId}-S1`,
          orderNumber: productionNumber(order, ++seq),
          parentId,
          mode: "SUBCONTRACTED",
          status: "SUBCONTRACTED",
          plannedQuantity: splitQty,
          goodQuantity: 0,
        },
      ];
    });
    return ok(paginatePage(rows, page, size));
  });
}

export function registerOrderActionMockRoutes(): void {
  registerCreditRoutes();
  registerProductionRoute();
}
