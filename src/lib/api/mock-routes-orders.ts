/**
 * Mock routes — Đơn hàng (module 14/17): list / detail / lịch sử / huỷ admin / giữ / gỡ giữ /
 * giao thất bại / đóng phần còn lại.
 *
 * Trả đúng hợp đồng BE `OrderController` + `OrderReleaseController` (develop, PR #133): body
 * `{ success, data }` (interceptor ở client.ts bóc), `OrderResponse` với status UPPER_CASE,
 * PageResponse trang từ 0, lỗi `{ errorCode, message, fieldErrors[], correlationId }`. Mock và BE thật
 * đi chung một đường parse ở `features/order/api.ts`. Store + suy diễn: `mock-routes-orders-store.ts`;
 * credit hold / lệnh sản xuất: `mock-routes-orders-actions.ts`; release + hình thức giao (PR #74):
 * `mock-routes-order-delivery-mode.ts`. Giao một phần (BE PR #150): ở file này.
 *
 * Thứ tự kiểm như BE: lỗi hình dạng body (bean validation) → 404 → quy tắc nghiệp vụ của `Order`.
 * File `mock-routes*.ts` + `mock-adapter.ts` là nơi duy nhất đọc `mock-data.ts`.
 */

import { paginatePage, registerMockRoute } from "./mock-adapter";
import { registerDeliveryModeMockRoutes } from "./mock-routes-order-delivery-mode";
import { registerOrderActionMockRoutes } from "./mock-routes-orders-actions";
import {
  BE_ORDER_STATUSES,
  CANCELLABLE_STATUSES,
  CANCELLATION_REASON_CODES,
  DELIVERY_FAILURE_REASONS,
  HOLDABLE_STATUSES,
  MANUAL_HOLD_REASONS,
  MOCK_TO_BACKEND_STATUS,
  STATUS_FILTER_ALIAS,
  allowsPartialShipment,
  applyTransition,
  backendStatus,
  bodyString,
  closeRemainder,
  error,
  findOrder,
  hasPrintLines,
  holdOf,
  idParam,
  isCustomLine,
  markDeliveryFailed,
  ok,
  packedOnlyAheadOfPrints,
  printingStarted,
  putOnHold,
  readBody,
  readParams,
  resumeFromHold,
  roundMoney,
  seedLifecycle,
  sessionHistory,
  shipmentsOf,
  termsMet,
  toOrderResponse,
  validationError,
  wasPacked,
} from "./mock-routes-orders-store";

import type { BeOrderStatus, MockHistoryEntry } from "./mock-routes-orders-store";
import type { Order } from "@/lib/mock-data";

export {
  backendOrderStatusOf,
  backendStatus,
  fakeSha256,
  hasPrintLines,
  isCodDeposit,
  isDeliveryModeLocked,
  lockedChecksumOf,
  mockOrderAllowsPartialShipment,
  putMockOrderOnDesignHold,
  resetOrderMockStore,
  resolveMockDesignHold,
  seedLifecycle,
  setMockOrderBalancePolicy,
  setMockOrderStatus,
  snapshotIdOf,
  toOrderResponse,
} from "./mock-routes-orders-store";
export type { MockDeliveryMode } from "./mock-routes-orders-store";

/** Người Sales của phiên demo — tên hiện ở lịch sử đơn (BE trả `actorName` của người quyết). */
const MOCK_SALES_ACTOR = { id: "USER-SALE-01", name: "Nhân viên Sales" } as const;

/** Điều phối viên của phiên demo — tên hiện ở lịch sử đơn khi đổi hình thức giao (BE PR #157). */
const MOCK_COORDINATOR_ACTOR = { id: "USER-COORD-01", name: "Điều phối đơn" } as const;

/** BE `Order#decidePartialShipment`: các trạng thái còn đổi được cách giao. */
const PARTIAL_SHIPMENT_OPEN_STATUSES: readonly BeOrderStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "PARTIALLY_FULFILLED",
  "PACKED",
  "ON_HOLD",
];

type OrderResponse = ReturnType<typeof toOrderResponse>;

const notFound = () => error(404, "NOT_FOUND", "Resource not found");

/** BE `InvalidOrderTransitionException` → 409 ORDER_INVALID_TRANSITION. */
const invalidTransition = (order: Order, from: string, to: string) =>
  error(
    409,
    "ORDER_INVALID_TRANSITION",
    `Order ${order.orderNumber} cannot move from ${from} to ${to}`,
  );

/** Enum không đọc được (Jackson) → BE 400 MALFORMED_REQUEST. */
const malformed = () => error(400, "MALFORMED_REQUEST", "The request body could not be read");

/** Ngày đặt theo múi giờ Asia/Ho_Chi_Minh — BE lọc `placedFrom/placedTo` cả hai đầu theo ngày VN. */
function placedDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function compareOrders(a: OrderResponse, b: OrderResponse, field: string): number {
  switch (field) {
    case "orderNumber":
      return a.orderNumber.localeCompare(b.orderNumber);
    case "totalAmount":
      return a.totalAmount - b.totalAmount;
    case "status":
      return a.status.localeCompare(b.status);
    default:
      return new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime();
  }
}

/**
 * BE `OrderStatusFilter#parse`: `status` lặp lại hoặc phân tách bằng dấu phẩy, không phân biệt hoa
 * thường; hai bí danh cũ còn nhận; tên lạ khác → null (route trả 400 UNSUPPORTED_PARAMETER).
 */
function parseStatusFilter(values: readonly string[]): BeOrderStatus[] | null {
  const statuses = new Set<BeOrderStatus>();
  for (const value of values.flatMap((raw) => raw.split(","))) {
    const name = value.trim().toUpperCase();
    if (!name) continue;
    const alias = STATUS_FILTER_ALIAS[name];
    const known = BE_ORDER_STATUSES.find((status) => status === name);
    if (alias) alias.forEach((status) => statuses.add(status));
    else if (known) statuses.add(known);
    else return null;
  }
  return [...statuses];
}

/** `"CODE"` / `"CODE: ghi chú"` → mã đó; chữ khác → OTHER + chữ làm ghi chú (BE `CancelOrderCommand.fromText`). */
function legacyReason(text: string): { reasonCode: string; note: string } {
  for (const code of CANCELLATION_REASON_CODES) {
    if (text === code) return { reasonCode: code, note: "" };
    if (text.startsWith(`${code}:`))
      return { reasonCode: code, note: text.slice(code.length + 1).trim() };
  }
  return { reasonCode: "OTHER", note: text };
}

interface AgreedFee {
  amount: number;
  reason: string;
  detail: string;
}

/** `AdminCancelOrderRequest.agreedFee` — `CancellationFeeRequest` (@NotNull amount > 0, reason, detail). */
function readAgreedFee(value: unknown): AgreedFee | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") return "invalid";
  const fee = value as Record<string, unknown>;
  const reason = typeof fee.reason === "string" ? fee.reason.trim() : "";
  const detail = typeof fee.detail === "string" ? fee.detail.trim() : "";
  if (typeof fee.amount !== "number" || !(fee.amount > 0)) return "invalid";
  if (!reason || reason.length > 500 || !detail || detail.length > 2000) return "invalid";
  return { amount: fee.amount, reason, detail };
}

function isWholeUnits(amount: number, currency: string): boolean {
  return roundMoney(amount, currency) === amount;
}

/**
 * Phí đã thoả thuận khi đóng phần còn lại (BE PR #150, `Order#requireRemainderFee`): chỉ khi hàng in đã in; > 0,
 * nguyên VND, lý do ≤ 500 + chi tiết ≤ 2000 bắt buộc, tối đa giá trị phần hàng in bị đóng. Kiểm trước khi đổi gì.
 */
function remainderFeeError(order: Order, fee: unknown) {
  if (fee === undefined || fee === null) return null;
  // Mock coi đơn có dòng in là đã bắt đầu in (mock-data không có mốc bắt đầu in)
  if (!hasPrintLines(order)) {
    return error(
      409,
      "CANCELLATION_FEE_BEFORE_PRINTING",
      `Order ${order.orderNumber} has not started printing: its rest is closed without a fee`,
    );
  }
  const body = typeof fee === "object" ? (fee as Record<string, unknown>) : {};
  const amount = body.amount;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const detail = typeof body.detail === "string" ? body.detail.trim() : "";
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0)
    return validationError("agreedFee.amount", "The agreed amount is more than zero, in whole VND");
  const state = seedLifecycle(order);
  const shipped = (lineId: string) =>
    state.shipments
      .filter((shipment) => shipment.status !== "RETURNED")
      .flatMap((shipment) => shipment.lines)
      .filter((line) => line.lineId === lineId)
      .reduce((sum, line) => sum + line.quantity, 0);
  const closedPrints = order.lines.filter(isCustomLine).reduce((sum, line) => {
    const left = line.quantity - (state.closedUnits[line.lineId] ?? 0) - shipped(line.lineId);
    return sum + Math.max(0, left) * line.unitPrice;
  }, 0);
  if (amount > closedPrints) {
    return error(
      400,
      "VALIDATION_FAILED",
      `The agreed amount is at most the value of the print units closed, ${closedPrints} VND`,
    );
  }
  if (!reason || reason.length > 500 || !detail || detail.length > 2000)
    return validationError(
      "agreedFee",
      "An agreed amount needs its reason (at most 500 characters) and its detail (at most 2000)",
    );
  return null;
}

function registerReadRoutes(): void {
  // GET /orders — BE OrderController#list (SCRUM-443): search, status (lặp), customerId, placedFrom/To, sort.
  registerMockRoute("GET", "/orders", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const params = readParams(config);
    const page = Math.max(0, Number(params.get("page")) || 0);
    const size = Math.max(1, Number(params.get("size")) || 15);
    const search = params.get("search")?.trim().toLowerCase();
    const statuses = parseStatusFilter(params.getAll("status"));
    const customerId = params.get("customerId");
    const placedFrom = params.get("placedFrom");
    const placedTo = params.get("placedTo");
    const [sortField = "placedAt", sortDir = "desc"] = (
      params.get("sort") ?? "placedAt,desc"
    ).split(",");

    if (!statuses) {
      return error(400, "UNSUPPORTED_PARAMETER", "Unknown order status", [
        { field: "status", message: `must be one of ${BE_ORDER_STATUSES.join(", ")}` },
      ]);
    }
    // BE OrderServiceImpl: placedTo trước placedFrom → 400 VALIDATION_FAILED
    if (placedFrom && placedTo && placedTo < placedFrom) {
      return validationError("placedTo", "placedTo must not be before placedFrom", "Range");
    }

    let filtered = orders.map(toOrderResponse);
    if (search)
      filtered = filtered.filter((o) =>
        [o.orderNumber, o.contactName, o.contactPhone].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    if (statuses.length) filtered = filtered.filter((o) => statuses.includes(o.status));
    if (customerId) filtered = filtered.filter((o) => o.customerId === customerId);
    if (placedFrom) filtered = filtered.filter((o) => placedDay(o.placedAt) >= placedFrom);
    if (placedTo) filtered = filtered.filter((o) => placedDay(o.placedAt) <= placedTo);
    filtered.sort((a, b) => {
      const result = compareOrders(a, b, sortField);
      return sortDir === "desc" ? -result : result;
    });

    // BE: dòng danh sách không mang lines (OrderSearchRepository — "no lines")
    const pageData = paginatePage(filtered, page, size);
    return ok({ ...pageData, items: pageData.items.map((o) => ({ ...o, lines: [] })) });
  });

  // GET /orders/:id
  registerMockRoute("GET", "/orders/:id", async (config) => {
    const order = await findOrder(idParam(config));
    if (!order) return notFound();
    return ok(toOrderResponse(order));
  });

  // GET /orders/:id/history — dựng từ `orderEvents` (module 17) + bước phát sinh trong phiên
  registerMockRoute("GET", "/orders/:id/history", async (config) => {
    const order = await findOrder(idParam(config));
    if (!order) return notFound();
    const { orderEvents } = await import("@/lib/mock-data");

    const seeded: MockHistoryEntry[] = [];
    for (const event of orderEvents.filter((e) => e.orderId === order.orderId)) {
      if (!event.toStatus) continue;
      const to = MOCK_TO_BACKEND_STATUS[event.toStatus];
      const from = event.fromStatus ? MOCK_TO_BACKEND_STATUS[event.fromStatus] : null;
      // Gộp 20 → 19 trạng thái: bỏ bước không đổi trạng thái BE (vd Shipped → In Transit)
      if (from === to) continue;
      seeded.push({ from, to, reason: event.description, occurredAt: event.createdAt });
    }
    const first: MockHistoryEntry = {
      from: null,
      to: seeded[0]?.from ?? MOCK_TO_BACKEND_STATUS[order.status],
      reason: null,
      occurredAt: order.placedAt,
    };
    const statusChanges = [first, ...seeded, ...sessionHistory(order)].map((entry) => ({
      type: "STATUS_CHANGE",
      ...entry,
    }));
    // BE PR #150 / #157: quyết định giao một phần (Sales) + đổi hình thức giao (điều phối viên) xen giữa
    const state = seedLifecycle(order);
    const decisions = state.decisions.map((decision) => ({
      type: "PARTIAL_SHIPMENT_DECISION",
      from: null,
      to: null,
      reason: decision.note,
      occurredAt: decision.decidedAt,
      actorId: MOCK_SALES_ACTOR.id,
      actorName: MOCK_SALES_ACTOR.name,
      partialShipmentAllowed: decision.allowed,
    }));
    const modeChanges = state.deliveryModeChanges.map((change) => ({
      type: "DELIVERY_MODE_CHANGE",
      from: null,
      to: null,
      reason: change.note,
      occurredAt: change.changedAt,
      actorId: MOCK_COORDINATOR_ACTOR.id,
      actorName: MOCK_COORDINATOR_ACTOR.name,
      deliveryMode: change.mode,
      previousDeliveryMode: change.previousMode,
    }));
    // Cũ nhất trước như BE; sort ổn định giữ thứ tự ghi của các mục cùng thời điểm
    const entries = [...statusChanges, ...decisions, ...modeChanges].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
    return ok(entries);
  });

  // PUT /orders/:id/partial-shipment {allowed, note?} — BE `sales-order-partial-shipments:UPDATE` (BE PR #150)
  registerMockRoute("PUT", "/orders/:id/partial-shipment", async (config) => {
    const order = await findOrder(idParam(config));
    if (!order) return notFound();
    const body = readBody(config);
    const note = bodyString(body, "note");
    if (typeof body.allowed !== "boolean") return validationError("allowed", "allowed is required");
    if (note.length > 500) return validationError("note", "note is at most 500 characters");

    const state = seedLifecycle(order);
    const current = backendStatus(order);
    // BE `Order#decidePartialShipment`: từ SHIPPED trở đi (và đơn huỷ / đóng) không đổi được
    if (!PARTIAL_SHIPMENT_OPEN_STATUSES.includes(current)) {
      return error(
        409,
        "ORDER_PARTIAL_SHIPMENT_LOCKED",
        `Order ${order.orderNumber} is ${current}: whether it ships in parts can no longer change`,
      );
    }
    // Quyết định không đổi gì thì BE không ghi vào lịch sử
    if (allowsPartialShipment(order) !== body.allowed) {
      state.allowPartialShipment = body.allowed;
      state.decisions.push({
        allowed: body.allowed,
        note: note || null,
        decidedAt: new Date().toISOString(),
      });
    }
    return ok(toOrderResponse(order));
  });
}

function registerCancellationRoute(): void {
  // POST /orders/:id/admin-cancellation — BE OrderController#adminCancel (AdminCancelOrderRequest)
  // → Order#cancel. Trả OrderResponse.
  registerMockRoute("POST", "/orders/:id/admin-cancellation", async (config) => {
    const body = readBody(config);
    const retained = body.retainedPercent;
    if (retained !== undefined && retained !== null && typeof retained !== "number")
      return malformed();
    // Bean validation: @DecimalMin(0) @DecimalMax(100), note ≤ 1000, reason ≤ 500
    if (typeof retained === "number" && (retained < 0 || retained > 100)) {
      return validationError(
        "retainedPercent",
        "retainedPercent is between 0 and 100",
        "DecimalMax",
      );
    }
    const fee = readAgreedFee(body.agreedFee);
    if (fee === "invalid")
      return validationError("agreedFee", "amount, reason and detail are required");

    // reasonCode là hợp đồng hiện tại; `reason` (chữ tự do) chỉ còn để tương thích ngược (deprecated)
    let reasonCode = bodyString(body, "reasonCode");
    let note = bodyString(body, "note");
    if (!reasonCode) {
      const legacy = bodyString(body, "reason");
      if (!legacy) return validationError("reasonCode", "reasonCode is required", "NotNull");
      ({ reasonCode, note } = legacyReason(legacy));
    } else if (!CANCELLATION_REASON_CODES.includes(reasonCode)) {
      return malformed();
    }

    // 404 chứ không 403 — không tiết lộ đơn có tồn tại hay không (BE findByIdInScope).
    const order = await findOrder(idParam(config));
    if (!order) return notFound();

    // ── Order#cancel, đúng thứ tự BE
    if (fee) {
      if (typeof retained === "number") {
        return validationError("agreedFee", "Keep a percentage or an agreed amount, not both");
      }
      if (!isWholeUnits(fee.amount, order.currency) || fee.amount > order.grandTotal) {
        return validationError(
          "agreedFee",
          "The agreed amount is more than zero, at most the total",
        );
      }
    }
    if (reasonCode === "OTHER" && !note) {
      return validationError("note", "A cancellation for OTHER must say why in the note");
    }
    const current = backendStatus(order);
    // BE BR-031 + BR-ORD-004: không có cạnh → CANCELLED (gồm đơn đã huỷ) hoặc đã đóng gói (packedAt, kể
    // cả đơn ON_HOLD bị giữ từ PACKED / PARTIALLY_FULFILLED) → 409 ORDER_NOT_CANCELLABLE
    if (!CANCELLABLE_STATUSES.includes(current) || current === "CANCELLED") {
      return error(
        409,
        "ORDER_NOT_CANCELLABLE",
        `Order ${order.orderNumber} is ${current} and can no longer be cancelled; raise a return instead`,
      );
    }
    // BE PR #150: đã đóng gói thì không huỷ — trừ hàng có sẵn đóng trước hàng in mà chưa lô nào rời kho
    if (wasPacked(order) && !packedOnlyAheadOfPrints(order)) {
      return error(
        409,
        "ORDER_NOT_CANCELLABLE",
        `Order ${order.orderNumber} is packed; it can no longer be cancelled - raise a return instead`,
      );
    }
    // Quyết định 2026-10-17 (BR-ORD-004): chưa in thì hoàn đủ, không giữ phí / phần trăm nào
    const keepsSomething = fee !== null || (typeof retained === "number" && retained > 0);
    if (keepsSomething && !printingStarted(order)) {
      return error(
        409,
        "CANCELLATION_FEE_BEFORE_PRINTING",
        "Printing has not started: the order is refunded in full, no fee is kept",
      );
    }

    // Tiền đã nhận trả phí thoả thuận trước (Q6a/Q6b); không thì theo phần trăm
    const retainedAmount = fee
      ? Math.min(fee.amount, order.amountPaid)
      : roundMoney(
          (order.amountPaid * (typeof retained === "number" ? retained : 0)) / 100,
          order.currency,
        );
    // BE Order#cancel: cột lý do (đơn + lịch sử) = "CODE" hoặc "CODE: ghi chú"
    const reasonText = note ? `${reasonCode}: ${note}` : reasonCode;
    applyTransition(order, "CANCELLED", reasonText, {
      cancellation: {
        reasonCode,
        reason: reasonText,
        retainedAmount,
        feeReason: fee?.reason ?? null,
        feeDetail: fee?.detail ?? null,
        feeAmount: fee?.amount ?? null,
      },
    });
    return ok(toOrderResponse(order));
  });
}

/* ── Giữ / gỡ giữ / giao thất bại / đóng phần còn lại (BE PR #133) ───── */

function registerLifecycleRoutes(): void {
  // POST /orders/:id/hold {reasonCode, note?} — sales-orders:APPROVE (BE Order#putOnHold)
  registerMockRoute("POST", "/orders/:id/hold", async (config) => {
    const body = readBody(config);
    const reasonCode = bodyString(body, "reasonCode");
    const note = bodyString(body, "note");
    if (!reasonCode) return validationError("reasonCode", "reasonCode is required", "NotNull");
    const order = await findOrder(idParam(config));
    if (!order) return notFound();
    // CREDIT / DESIGN_MISMATCH là của hệ thống (HoldReason#raisedByHand)
    const reason = MANUAL_HOLD_REASONS.find((manual) => manual === reasonCode);
    if (!reason) return validationError("reasonCode", "reasonCode is not allowed");
    if (reason === "OTHER" && !note) {
      return validationError("note", "A hold for OTHER must say why in the note");
    }
    const current = backendStatus(order);
    if (!HOLDABLE_STATUSES.includes(current)) return invalidTransition(order, current, "ON_HOLD");
    putOnHold(order, reason, note || null);
    return ok(toOrderResponse(order));
  });

  // POST /orders/:id/hold/resolution {note} — sales-orders:APPROVE (BE Order#resolveHold)
  registerMockRoute("POST", "/orders/:id/hold/resolution", async (config) => {
    const note = bodyString(readBody(config), "note");
    // ResolveHoldRequest.note @NotBlank — bean validation chạy trước service
    if (!note) return validationError("note", "note is required", "NotBlank");
    const order = await findOrder(idParam(config));
    if (!order) return notFound();
    const hold = holdOf(order);
    if (!hold) return error(409, "ORDER_NOT_ON_HOLD", "This order is not on hold");
    if (hold.reason === "CREDIT" || !hold.statusBeforeHold) {
      return error(
        409,
        "ORDER_CREDIT_HOLD_USE_APPROVAL",
        "A credit hold is decided through credit approval",
      );
    }
    if (hold.reason === "DESIGN_MISMATCH") {
      return error(
        409,
        "ORDER_DESIGN_HOLD_USE_REVERIFICATION",
        "A design hold is resolved by reverifying the package",
      );
    }
    // G2-3: giữ vì thanh toán gỡ bằng tiền, không bằng ghi chú
    if (hold.reason === "PAYMENT" && !termsMet(order)) {
      return error(409, "ORDER_BALANCE_NOT_PAID", "This order must be paid before its goods leave");
    }
    resumeFromHold(order, note);
    return ok(toOrderResponse(order));
  });

  // POST /orders/:id/delivery-failure {reasonCode, note?} — sales-orders:APPROVE (BE Order#markDeliveryFailed)
  registerMockRoute("POST", "/orders/:id/delivery-failure", async (config) => {
    const body = readBody(config);
    const reasonCode = bodyString(body, "reasonCode");
    const note = bodyString(body, "note");
    if (!reasonCode) return validationError("reasonCode", "reasonCode is required", "NotNull");
    if (!DELIVERY_FAILURE_REASONS.includes(reasonCode)) return malformed();
    const order = await findOrder(idParam(config));
    if (!order) return notFound();
    if (reasonCode === "OTHER" && !note) {
      return validationError("note", "A failed delivery for OTHER must say why in the note");
    }
    // Đơn đã chia lô ghi kết quả theo từng lô (G4-Q5)
    if (shipmentsOf(order).length) {
      return error(
        409,
        "ORDER_DELIVERY_VIA_SHIPMENT",
        "This order's delivery is recorded per shipment",
      );
    }
    const current = backendStatus(order);
    // Idempotent: đã DELIVERY_FAILED thì không đổi gì
    if (current === "DELIVERY_FAILED") return ok(toOrderResponse(order));
    if (current !== "SHIPPED") return invalidTransition(order, current, "DELIVERY_FAILED");
    markDeliveryFailed(order, reasonCode, note || null);
    return ok(toOrderResponse(order));
  });

  // POST /orders/:id/remainder-closure {reasonCode, note?, agreedFee?} — sales-order-cancellations:UPDATE
  // (BE Order#closeRemainder)
  registerMockRoute("POST", "/orders/:id/remainder-closure", async (config) => {
    const body = readBody(config);
    const reasonCode = bodyString(body, "reasonCode");
    const note = bodyString(body, "note");
    if (!reasonCode) return validationError("reasonCode", "reasonCode is required", "NotNull");
    if (!CANCELLATION_REASON_CODES.includes(reasonCode)) return malformed();
    const order = await findOrder(idParam(config));
    if (!order) return notFound();
    if (reasonCode === "OTHER" && !note) {
      return validationError("note", "Closing the rest for OTHER must say why in the note");
    }
    const current = backendStatus(order);
    if (current !== "PARTIALLY_FULFILLED") {
      return invalidTransition(order, current, "a closed remainder");
    }
    const feeError = remainderFeeError(order, body.agreedFee);
    if (feeError) return feeError;
    closeRemainder(order, reasonCode, note || null);
    return ok(toOrderResponse(order));
  });
}

export function registerOrderMockRoutes(): void {
  // Đăng ký TRƯỚC `/orders/:id`: adapter khớp theo thứ tự đăng ký, `/orders/credit-holds` sẽ bị
  // `/orders/:id` nuốt nếu đăng ký sau.
  registerOrderActionMockRoutes();
  registerReadRoutes();
  registerCancellationRoute();
  registerLifecycleRoutes();
  // Release + đổi hình thức giao (PR #74 sở hữu release)
  registerDeliveryModeMockRoutes();
}
