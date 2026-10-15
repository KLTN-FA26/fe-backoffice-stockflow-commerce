/**
 * Mock routes — thao tác điều phối đơn: release (SCRUM-423), credit hold (SCRUM-427), lệnh sản
 * xuất của đơn (CONTRACT PENDING — BE chưa có endpoint, chỉ mock trả dữ liệu).
 *
 * Thứ tự kiểm + mã lỗi chép theo BE develop: OrderReleaseService, CreditHoldService.
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
  idParam,
  isCustomLine,
  mockCustomerUuid,
  ok,
  paymentTermOf,
  readBody,
  readParams,
  toOrderResponse,
} from "./mock-routes-orders-store";

import type { Order } from "@/lib/mock-data";

/** ASSUMPTION (mock-only): mẫu được khách duyệt ⇔ thiết kế đã `Locked` (docs 12: khoá khi chốt mẫu). */
async function hasApprovedSample(designId: string): Promise<boolean> {
  const { designs } = await import("@/lib/mock-data");
  return designs.find((d) => d.designId === designId)?.status === "Locked";
}

/** Dư nợ của khách = tổng phần chưa thu của các đơn công nợ khác còn hiệu lực. */
async function exposureOf(order: Order): Promise<number> {
  const { orders } = await import("@/lib/mock-data");
  return orders
    .filter((o) => o.orderId !== order.orderId && o.customerId === order.customerId)
    .filter((o) => paymentTermOf(o) === "CREDIT" && backendStatus(o) !== "CANCELLED")
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
    .filter((o) => o.customerId === mockCustomerId && paymentTermOf(o) === "CREDIT")
    .filter((o) => !["CANCELLED", "ON_HOLD"].includes(backendStatus(o)))
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

function isCreditHold(order: Order): boolean {
  return backendStatus(order) === "ON_HOLD" && paymentTermOf(order) === "CREDIT";
}

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

function registerReleaseRoute(): void {
  // POST /orders/:id/release {warehouseId} — BE OrderReleaseService#release
  registerMockRoute("POST", "/orders/:id/release", async (config) => {
    const order = await findOrder(idParam(config));
    if (!order) return error(404, "NOT_FOUND", "Resource not found");

    const warehouseId = readBody(config).warehouseId;
    if (typeof warehouseId !== "string" || !warehouseId) {
      return error(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "warehouseId", message: "must not be null", code: "NotNull" },
      ]);
    }
    const { warehouses } = await import("@/lib/mock-data");
    if (!warehouses.some((w) => w.warehouseId === warehouseId)) {
      return error(404, "WAREHOUSE_NOT_FOUND", `Warehouse ${warehouseId} not found`);
    }

    // BR-PRD-08 (docs 19 BR-08): dòng thiết kế mới chưa có mẫu duyệt không được release
    const blocked: string[] = [];
    for (const line of order.lines.filter(isCustomLine)) {
      if (line.designId && !(await hasApprovedSample(line.designId))) blocked.push(line.skuId);
    }
    if (blocked.length) {
      return error(
        409,
        "DESIGN_SAMPLE_NOT_APPROVED",
        `No approved sample for design on lines: ${blocked.join(", ")}`,
      );
    }

    const status = backendStatus(order);
    // BR-PRD-09 (docs 19 BR-09): đơn đặt cọc chưa nhận đủ cọc
    if (status === "PENDING_PAYMENT" && paymentTermOf(order) === "DEPOSIT") {
      return error(409, "ORDER_DEPOSIT_NOT_RECEIVED", "The deposit has not been received");
    }
    if (status !== "CONFIRMED") {
      return error(409, "CONFLICT", `Order cannot be released from status ${status}`);
    }

    // Order.java#release: có dòng in → IN_PRODUCTION, chỉ hàng sẵn → READY_TO_FULFILL
    const next = order.lines.some(isCustomLine) ? "IN_PRODUCTION" : "READY_TO_FULFILL";
    applyTransition(order, next, null, { warehouseId, releasedAt: new Date().toISOString() });
    return ok(toOrderResponse(order));
  });
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
    applyTransition(order, "CONFIRMED", note);
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
        applyTransition(order, "CANCELLED", note, {
          cancellation: { reasonCode: "CREDIT_REJECTED", reason: note, retainedAmount: 0 },
        });
        break;
      case "SWITCH_TO_PREPAID":
        applyTransition(order, "PENDING_PAYMENT", note, { paymentTerm: "PREPAID" });
        break;
      case "SWITCH_TO_DEPOSIT": {
        const depositPercent = readDepositPercent(body);
        if (depositPercent === INVALID) {
          return error(400, "VALIDATION_FAILED", "Invalid request data", DEPOSIT_PERCENT_INVALID);
        }
        // Bỏ trống → % cọc mặc định của hồ sơ khách (BE `terms.depositPercent()`)
        applyTransition(order, "PENDING_PAYMENT", note, {
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

/** Trạng thái LSX gốc suy từ trạng thái đơn (docs 19 §5.1 + docs 17 §4.2 bước 5–6). */
function parentStatusFor(status: string): string | null {
  switch (status) {
    case "IN_PRODUCTION":
      return "PRINTING";
    case "READY_TO_FULFILL":
    case "IN_FULFILMENT":
    case "SHIPPED":
    case "DELIVERED":
    case "COMPLETED":
    case "RETURNED":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return null;
  }
}

function registerProductionRoute(): void {
  // GET /orders/:id/production-orders — CONTRACT PENDING (features/order/production-schemas.ts)
  registerMockRoute("GET", "/orders/:id/production-orders", async (config) => {
    const order = await findOrder(idParam(config));
    if (!order) return error(404, "NOT_FOUND", "Resource not found");
    const parentStatus = parentStatusFor(backendStatus(order));
    // Đơn chưa release → chưa có LSX (docs 17 §4.2 bước 5: LSX sinh khi release)
    if (!parentStatus) return ok([]);
    const { suppliers } = await import("@/lib/mock-data");

    return ok(
      order.lines.filter(isCustomLine).flatMap((line, index) => {
        const parentId = `PRD-${line.lineId}`;
        const inProduction = parentStatus === "PRINTING";
        // ASSUMPTION (mock-only, docs 19 BR-12): dòng in đầu tiên của đơn đang sản xuất tách
        // 40% phần chưa xuất phôi sang gia công ngoài → có LSX con để demo cây gốc/con.
        const splitQty = inProduction && index === 0 ? Math.floor(line.quantity * 0.4) : 0;
        const parent = {
          productionOrderId: parentId,
          productionOrderNumber: `LSX-${line.lineId.replace("ORDL-", "")}`,
          salesOrderLineId: line.lineId,
          mode: "IN_HOUSE",
          status: parentStatus,
          plannedQuantity: line.quantity - splitQty,
          goodQuantity: parentStatus === "COMPLETED" ? line.quantity - splitQty : 0,
        };
        if (!splitQty) return [parent];
        return [
          parent,
          {
            productionOrderId: `${parentId}-S1`,
            productionOrderNumber: `${parent.productionOrderNumber}-S1`,
            salesOrderLineId: line.lineId,
            parentId,
            mode: "SUBCONTRACTED",
            status: "SUBCONTRACTED",
            plannedQuantity: splitQty,
            goodQuantity: 0,
            subcontractorName: suppliers[0]?.name ?? null,
          },
        ];
      }),
    );
  });
}

export function registerOrderActionMockRoutes(): void {
  registerCreditRoutes();
  registerReleaseRoute();
  registerProductionRoute();
}
