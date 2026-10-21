/**
 * Mock routes — Đơn hàng (module 14/17), tách khỏi `mock-routes.ts` như NCC.
 *
 * Trả đúng hợp đồng BE `OrderController` (develop): body `{ success, data }` (interceptor
 * ở client.ts bóc), `OrderResponse` với status UPPER_CASE, PageResponse trang từ 0, lỗi
 * `{ errorCode, message, fieldErrors[], correlationId }`. Mock và BE thật đi chung một
 * đường parse ở `features/order/api.ts`.
 * File này + `mock-routes*.ts` + `mock-adapter.ts` là nơi duy nhất đọc `mock-data.ts`.
 */

import { paginatePage, registerMockRoute } from "./mock-adapter";

import type { AxiosRequestConfig } from "axios";
import type { Order, OrderLine, OrderStatus } from "@/lib/mock-data";

export type BackendOrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "READY_TO_FULFILL"
  | "PICKING"
  | "PARTIALLY_FULFILLED"
  | "PACKED"
  | "ON_HOLD"
  | "SHIPPED"
  | "DELIVERY_FAILED"
  | "DELIVERED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "COMPLETED"
  | "CANCELLED"
  | "CLOSED";

/**
 * mock-data dùng 20 trạng thái docs 17; BE (PR #133) có 19 — gần như 1-1. "Payment Failed" gộp vào
 * CANCELLED (BE không có PAYMENT_FAILED, G3-Q2); "In Transit" là SHIPPED.
 */
const MOCK_TO_BACKEND_STATUS: Record<OrderStatus, BackendOrderStatus> = {
  "Pending Payment": "PENDING_PAYMENT",
  "Payment Failed": "CANCELLED",
  Confirmed: "CONFIRMED",
  "In Production": "IN_PRODUCTION",
  "Ready to Fulfill": "READY_TO_FULFILL",
  Picking: "PICKING",
  Packed: "PACKED",
  "Partially Fulfilled": "PARTIALLY_FULFILLED",
  "On Hold": "ON_HOLD",
  Shipped: "SHIPPED",
  "In Transit": "SHIPPED",
  "Delivery Failed": "DELIVERY_FAILED",
  Delivered: "DELIVERED",
  "Return Requested": "RETURN_REQUESTED",
  Completed: "COMPLETED",
  Closed: "CLOSED",
  Cancelled: "CANCELLED",
  Returned: "RETURNED",
  Refunded: "REFUNDED",
  "Partially Refunded": "PARTIALLY_REFUNDED",
};

/**
 * BE `OrderStatus#canTransitionTo` → CANCELLED (PR #133): DRAFT, PENDING_PAYMENT, CONFIRMED,
 * IN_PRODUCTION, READY_TO_FULFILL, PICKING, ON_HOLD. PACKED trở đi phải đi luồng trả hàng (BR-ORD-004) —
 * trừ hàng có sẵn đóng trước hàng in chưa bàn giao (BE PR #150, `packedOnlyAheadOfPrints`).
 */
const CANCELLABLE_STATUSES: readonly BackendOrderStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "ON_HOLD",
];

/** BE `OrderStatus#mayBePutOnHold`. */
const HOLDABLE_STATUSES: readonly BackendOrderStatus[] = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "PARTIALLY_FULFILLED",
  "PACKED",
];

/** BE `HoldReason#raisedByHand` — CREDIT và DESIGN_MISMATCH là của hệ thống. */
const MANUAL_HOLD_REASONS = ["PAYMENT", "ADDRESS", "INVENTORY", "CUSTOMER", "FRAUD", "OTHER"];
const DELIVERY_FAILURE_REASONS = [
  "CUSTOMER_ABSENT",
  "REFUSED",
  "WRONG_ADDRESS",
  "LOST",
  "DAMAGED",
  "OTHER",
];
/** BE `CancellationReasonCode` (mọi giá trị BE nhận cho remainder-closure). */
const CANCELLATION_REASONS = [
  "CUSTOMER_REQUEST",
  "PAYMENT_NOT_RECEIVED",
  "PAYMENT_FAILED",
  "OUT_OF_STOCK",
  "SUSPECTED_FRAUD",
  "CREDIT_REJECTED",
  "DUPLICATE_ORDER",
  "PRODUCTION_ISSUE",
  "OTHER",
];

/** Người Sales của phiên demo — tên hiện ở lịch sử đơn (BE trả `actorName` của người quyết). */
const MOCK_SALES_ACTOR = { id: "USER-SALE-01", name: "Nhân viên Sales" } as const;

/** BE `Order#decidePartialShipment`: các trạng thái còn đổi được cách giao. */
const PARTIAL_SHIPMENT_OPEN_STATUSES: readonly BackendOrderStatus[] = [
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

type ShipmentStatus = "HANDED_OVER" | "DELIVERED" | "DELIVERY_FAILED" | "RETURNED";

interface MockShipment {
  shipmentId: string;
  status: ShipmentStatus;
  handedOverAt: string;
  lines: { lineId: string; quantity: number }[];
}

/** Trạng thái mock-data mà đơn đã đóng gói xong ít nhất một lần (nên có `packedAt`). */
const PACKED_ONWARDS_MOCK_STATUSES: readonly OrderStatus[] = [
  "Packed",
  "Partially Fulfilled",
  "Shipped",
  "In Transit",
  "Delivery Failed",
  "Delivered",
  "Return Requested",
  "Completed",
  "Closed",
  "Returned",
  "Refunded",
  "Partially Refunded",
];

/** Trạng thái vòng đời đổi trong phiên mock: giữ đơn, giao thất bại, lô giao, phần đã đóng. */
interface MockLifecycle {
  status?: BackendOrderStatus;
  /** Lần đầu đóng gói xong (BE `packedAt`): từ đó đơn không huỷ được, kể cả khi bị giữ. */
  packedAt?: string;
  holdReason?: string;
  statusBeforeHold?: BackendOrderStatus;
  holdNote?: string;
  deliveryFailureReason?: string;
  shipments?: MockShipment[];
  closedUnits: Record<string, number>;
  /** Sales cho phép giao một phần (BE PR #150); chưa đặt = theo mặc định BE (xem `allowsPartialShipment`). */
  allowPartialShipment?: boolean;
  /** Quyết định giao một phần, cũ nhất trước (BE `order_partial_shipment_decision`). */
  decisions: MockPartialDecision[];
}

interface MockPartialDecision {
  allowed: boolean;
  note: string | null;
  decidedAt: string;
}

const lifecycleStore = new Map<string, MockLifecycle>();

export function resetOrderMockStore(): void {
  lifecycleStore.clear();
}

function lifecycleOf(orderId: string): MockLifecycle {
  let state = lifecycleStore.get(orderId);
  if (!state) {
    state = { closedUnits: {}, decisions: [] };
    lifecycleStore.set(orderId, state);
  }
  return state;
}

function backendStatus(order: Order): BackendOrderStatus {
  return lifecycleStore.get(order.orderId)?.status ?? MOCK_TO_BACKEND_STATUS[order.status];
}

/**
 * BE backfill (V20261022000400): `allow_partial_shipment = true` chỉ cho đơn đã đang giao từng phần; còn lại
 * false cho tới khi Sales bật.
 */
function allowsPartialShipment(order: Order): boolean {
  return (
    lifecycleStore.get(order.orderId)?.allowPartialShipment ??
    order.status === "Partially Fulfilled"
  );
}

/** Mock đóng gói hỏi cờ này như BE `PackingService` (PACK_PARTIAL_NOT_ALLOWED khi chưa bật). */
export async function mockOrderAllowsPartialShipment(orderId: string): Promise<boolean> {
  const { orders } = await import("@/lib/mock-data");
  const order = orders.find((o) => o.orderId === orderId);
  return order ? allowsPartialShipment(order) : false;
}

/** Đơn có dòng in (thiết kế khách chốt) — BE `Order#hasPrintLines`. */
const hasPrintLines = (order: Order) => order.lines.some((line) => line.designId);

/**
 * BE `Order#printLinesReady`: hàng in đã về bàn đóng gói — không có dòng in, hoặc không còn trong sản xuất
 * (đơn IN_PRODUCTION hoặc giữ từ đó thì chưa).
 */
function printLinesReady(order: Order, status: BackendOrderStatus, state: MockLifecycle): boolean {
  if (!hasPrintLines(order)) return true;
  const printing =
    status === "IN_PRODUCTION" ||
    (status === "ON_HOLD" && state.statusBeforeHold === "IN_PRODUCTION");
  return !printing;
}

/**
 * BE `Order#packedOnlyAheadOfPrints` (BE PR #150): hàng có sẵn đã đóng trước hàng in và chưa lô nào rời kho —
 * vẫn huỷ được.
 */
function packedOnlyAheadOfPrints(status: BackendOrderStatus, state: MockLifecycle): boolean {
  const printing =
    status === "IN_PRODUCTION" ||
    (status === "ON_HOLD" && state.statusBeforeHold === "IN_PRODUCTION");
  return state.packedAt !== undefined && printing && (state.shipments ?? []).length === 0;
}

/**
 * Dữ liệu seed theo trạng thái mock-data (mock-data không có các field này): đơn "On Hold" giữ vì
 * ADDRESS từ PICKING; đơn "Partially Fulfilled" đã bàn giao một lô (thiếu 2 đơn vị — ghi chú
 * "Pick Short 2" của mock-data); đơn "Delivery Failed" do khách vắng mặt.
 */
function seedLifecycle(order: Order): MockLifecycle {
  const state = lifecycleOf(order.orderId);
  if (state.holdReason === undefined && MOCK_TO_BACKEND_STATUS[order.status] === "ON_HOLD") {
    state.holdReason = "ADDRESS";
    state.statusBeforeHold = "PICKING";
    state.holdNote = "Sai phường — chờ khách xác nhận địa chỉ";
  }
  if (state.deliveryFailureReason === undefined && order.status === "Delivery Failed") {
    state.deliveryFailureReason = "CUSTOMER_ABSENT";
  }
  // Đơn đã qua khâu đóng gói thì `packedAt` đã có (BE `Order#markPacked`); đơn đang lấy hàng / bị giữ từ
  // PICKING thì chưa.
  if (state.packedAt === undefined && PACKED_ONWARDS_MOCK_STATUSES.includes(order.status)) {
    state.packedAt = order.shippedAt ?? order.placedAt;
  }
  const first = order.lines[0];
  if (!state.shipments && order.status === "Partially Fulfilled" && first) {
    state.shipments = [
      {
        shipmentId: `${order.orderId}-SHIP-1`,
        status: "HANDED_OVER",
        handedOverAt: order.shippedAt ?? order.placedAt,
        lines: [{ lineId: first.lineId, quantity: Math.max(1, first.quantity - 2) }],
      },
    ];
  }
  return state;
}

/** Trạng thái BE hiện tại của một đơn mock — cho mock xuất kho (`requireOrderInFulfilment`). */
export async function backendOrderStatusOf(
  orderId: string,
): Promise<BackendOrderStatus | undefined> {
  const { orders } = await import("@/lib/mock-data");
  const order = orders.find((o) => o.orderId === orderId);
  return order ? backendStatus(order) : undefined;
}

/**
 * Mock xuất kho đổi trạng thái đơn như BE (READY_TO_FULFILL → PICKING → PACKED). Rời ON_HOLD thì xoá
 * dữ liệu giữ.
 */
export function setMockOrderStatus(orderId: string, status: BackendOrderStatus): void {
  const state = lifecycleOf(orderId);
  state.status = status;
  if (status === "PACKED") state.packedAt ??= new Date().toISOString();
  if (status !== "ON_HOLD") {
    state.holdReason = undefined;
    state.statusBeforeHold = undefined;
    state.holdNote = undefined;
  }
}

/** Mock xuất kho giữ đơn do lệch checksum thiết kế (BE `HoldReason.DESIGN_MISMATCH`). */
export async function putMockOrderOnDesignHold(orderId: string): Promise<void> {
  const before = (await backendOrderStatusOf(orderId)) ?? "PICKING";
  const state = lifecycleOf(orderId);
  state.status = "ON_HOLD";
  state.holdReason = "DESIGN_MISMATCH";
  state.statusBeforeHold = before;
  state.holdNote = undefined;
}

/**
 * Mock kiểm tra lại thiết kế khớp: gỡ giữ DESIGN_MISMATCH, đơn về đúng bước đang làm trước khi bị giữ
 * (BE `OrderService.resolveDesignHold`) — KHÔNG sang PACKED, người đóng gói hoàn tất lại (BE PR #136).
 */
export function resolveMockDesignHold(orderId: string): void {
  const state = lifecycleOf(orderId);
  setMockOrderStatus(orderId, state.statusBeforeHold ?? "PICKING");
}

/** SHA-256 giả 64 hex, ổn định theo seed (FNV-1a lặp 8 lần). */
export function fakeSha256(seed: string): string {
  let out = "";
  for (let round = 0; round < 8; round++) {
    let hash = 0x811c9dc5;
    for (const char of `${round}:${seed}`) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
    }
    out += (hash >>> 0).toString(16).padStart(8, "0");
  }
  return out;
}

/** Dòng mock có `designId` = dòng tuỳ chỉnh: BE trả snapshot đã khoá + SHA-256 của bundle. */
export const snapshotIdOf = (line: OrderLine) => `SNAP-${line.designId ?? ""}`;
export const lockedChecksumOf = (line: OrderLine) => fakeSha256(line.lineId);

/**
 * BE (PR #133) còn nhận hai tên cũ ở bộ lọc `status` thêm một sprint: `IN_FULFILMENT` = PICKING,
 * PARTIALLY_FULFILLED, PACKED; `PAID` = CONFIRMED (OrderStatusFilter).
 */
const STATUS_FILTER_ALIAS: Readonly<Record<string, readonly string[]>> = {
  IN_FULFILMENT: ["PICKING", "PARTIALLY_FULFILLED", "PACKED"],
  PAID: ["CONFIRMED"],
};

/** mock-data `Order` → BE `OrderResponse`. Chỉ field có trong hợp đồng BE. */
function toOrderResponse(order: Order) {
  const address = {
    recipientName: order.recipientName,
    phone: order.recipientPhone,
    line1: order.shippingAddress.street,
    line2: order.shippingAddress.district,
    wardCode: null,
    wardName: order.shippingAddress.ward,
    provinceCode: null,
    provinceName: order.shippingAddress.province,
    countryCode: order.shippingAddress.country,
    postalCode: order.shippingAddress.postalCode,
  };
  const state = seedLifecycle(order);
  const status = backendStatus(order);
  const shipments = state.shipments ?? [];
  const unitsIn = (lineId: string, statuses: readonly ShipmentStatus[]) =>
    shipments
      .filter((shipment) => statuses.includes(shipment.status))
      .flatMap((shipment) => shipment.lines)
      .filter((line) => line.lineId === lineId)
      .reduce((sum, line) => sum + line.quantity, 0);
  const closedValue = order.lines.reduce(
    (sum, line) => sum + (state.closedUnits[line.lineId] ?? 0) * line.unitPrice,
    0,
  );
  const effectiveTotal = order.grandTotal - closedValue;
  const onHold = status === "ON_HOLD";
  // mock-data chỉ có phương thức thanh toán: cọc → DEPOSIT, còn lại trả trước
  const paymentTerm = order.paymentMethodType === "Deposit" ? "DEPOSIT" : "PREPAID";
  const amountDue = Math.max(0, effectiveTotal - order.amountPaid);
  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    status,
    totalAmount: order.grandTotal,
    currency: order.currency,
    lines: order.lines.map((line) => ({
      lineId: line.lineId,
      sku: line.skuId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      reservationIds: [],
      designSnapshotId: line.designId ? snapshotIdOf(line) : null,
      designChecksum: line.designId ? lockedChecksumOf(line) : null,
      // BE (`OrderServiceImpl#lifecycleOf`) LUÔN gửi ba số, 0 khi chưa có lô. shipped = mọi đơn vị đã
      // bàn giao và chưa trả về (gồm cả đã giao).
      shippedQuantity: unitsIn(line.lineId, ["HANDED_OVER", "DELIVERY_FAILED", "DELIVERED"]),
      deliveredQuantity: unitsIn(line.lineId, ["DELIVERED"]),
      cancelledQuantity: state.closedUnits[line.lineId] ?? 0,
    })),
    placedAt: order.placedAt,
    createdBy: order.createdById ?? null,
    lastModifiedAt: null,
    lastModifiedBy: null,
    contactName: order.recipientName,
    contactEmail: null,
    contactPhone: order.recipientPhone,
    shippingAddress: address,
    billingAddress: null,
    // Staff view: lý do + ghi chú giữ (khách chỉ thấy holdReasonPublic)
    holdReason: onHold ? (state.holdReason ?? null) : null,
    holdReasonPublic: onHold
      ? state.holdReason === "CREDIT"
        ? "AWAITING_CREDIT_APPROVAL"
        : "UNDER_REVIEW"
      : null,
    statusBeforeHold: onHold ? (state.statusBeforeHold ?? null) : null,
    holdNote: onHold ? (state.holdNote ?? null) : null,
    packedAt: state.packedAt ?? null,
    shippedAt: order.shippedAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    deliveryFailureReason:
      status === "DELIVERY_FAILED" ? (state.deliveryFailureReason ?? null) : null,
    completedAt: order.completedAt ?? null,
    closedAt: null,
    // BE luôn gửi các số tiền này: billedAmount bắt đầu từ 0 (`Order#billedAmount`); amountDue tính từ tổng
    // đơn kể cả đơn nháp / đã huỷ; amountDueBeforeHandover = amountDue với PREPAID, 0 với DEPOSIT / CREDIT.
    paymentTerm,
    billedAmount: 0,
    effectiveTotal,
    amountDue,
    amountDueBeforeHandover: paymentTerm === "PREPAID" ? amountDue : 0,
    // Đơn cọc: BE ghi cách thu phần còn lại (mặc định BEFORE_DELIVERY, BE PR #150 thêm ON_CREDIT); đơn khác null
    balancePolicy: paymentTerm === "DEPOSIT" ? "BEFORE_DELIVERY" : null,
    creditTermDays: null,
    allowPartialShipment: allowsPartialShipment(order),
    printLinesReady: printLinesReady(order, status, state),
    shipments: shipments.length
      ? shipments.map((shipment) => ({
          shipmentId: shipment.shipmentId,
          status: shipment.status,
          amount: shipment.lines.reduce(
            (sum, line) =>
              sum +
              line.quantity * (order.lines.find((l) => l.lineId === line.lineId)?.unitPrice ?? 0),
            0,
          ),
          billedAmount: null,
          handedOverAt: shipment.handedOverAt,
          outcomeAt: null,
          failureReason: null,
          lines: shipment.lines,
        }))
      : null,
  };
}

/**
 * Bỏ mọi key có giá trị null (đệ quy) — giống BE Jackson `default-property-inclusion: non_null`
 * (application.yml). Không bỏ thì mock trả `null` tường minh và che lỗi schema đòi bắt buộc có key
 * (vd đơn guest: BE không gửi `customerId`).
 */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => [k, withoutNulls(v)]),
  );
}

function ok(data: unknown) {
  return { status: 200, data: withoutNulls({ success: true, data }), headers: {} };
}

function error(status: number, errorCode: string, message: string, fieldErrors?: unknown[]) {
  return {
    status,
    data: { success: false, errorCode, message, fieldErrors, correlationId: `mock-${Date.now()}` },
    headers: {},
  };
}

function idParam(config: AxiosRequestConfig): string {
  const params = (config as Record<string, unknown>)._mockParams as Record<string, string>;
  return decodeURIComponent(params.id ?? "");
}

function readParams(config: AxiosRequestConfig): URLSearchParams {
  if (config.params instanceof URLSearchParams) return new URLSearchParams(config.params);
  return new URLSearchParams(config.url?.split("?")[1] ?? "");
}

function readBodyString(data: unknown, key: string): string {
  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = {};
    }
  }
  if (typeof parsed !== "object" || parsed === null || !(key in parsed)) return "";
  const value: unknown = (parsed as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

const readReason = (data: unknown) => readBodyString(data, "reason");

function readBody(data: unknown): Record<string, unknown> {
  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = {};
    }
  }
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

type OrderResponse = ReturnType<typeof toOrderResponse>;

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

export function registerOrderMockRoutes(): void {
  // GET /orders — ASSUMPTION: BE chưa có list admin; PageResponse trang từ 0,
  // `search`/`status` (giá trị BE)/`sort=field,dir` theo quy ước NCC.
  registerMockRoute("GET", "/orders", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const params = readParams(config);
    const page = Math.max(0, Number(params.get("page")) || 0);
    const size = Math.max(1, Number(params.get("size")) || 15);
    const search = params.get("search")?.trim().toLowerCase();
    const statuses = params
      .getAll("status")
      .flatMap((value) => STATUS_FILTER_ALIAS[value] ?? [value]);
    const [sortField = "placedAt", sortDir = "desc"] = (
      params.get("sort") ?? "placedAt,desc"
    ).split(",");

    let filtered = orders.map(toOrderResponse);
    if (search)
      filtered = filtered.filter((o) =>
        [o.orderNumber, o.contactName, o.contactPhone, o.orderId].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    if (statuses.length) filtered = filtered.filter((o) => statuses.includes(o.status));
    filtered.sort((a, b) => {
      const result = compareOrders(a, b, sortField);
      return sortDir === "desc" ? -result : result;
    });

    return ok(paginatePage(filtered, page, size));
  });

  // GET /orders/:id
  registerMockRoute("GET", "/orders/:id", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const order = orders.find((o) => o.orderId === idParam(config));
    if (!order) return error(404, "NOT_FOUND", "Resource not found");
    return ok(toOrderResponse(order));
  });

  // POST /orders/:id/admin-cancellation — BE OrderController#adminCancel, scope ALL.
  registerMockRoute("POST", "/orders/:id/admin-cancellation", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const order = orders.find((o) => o.orderId === idParam(config));
    // 404 chứ không 403 — không tiết lộ đơn có tồn tại hay không (BE findByIdInScope).
    if (!order) return error(404, "NOT_FOUND", "Resource not found");

    if (!readReason(config.data)) {
      return error(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "reason", message: "reason is required", code: "NotBlank" },
      ]);
    }

    const current = backendStatus(order);
    // BE PR #133: đã có packedAt → 409 ORDER_NOT_CANCELLABLE (`Order#requireNotPacked`, kể cả đơn ON_HOLD
    // bị giữ từ PACKED / PARTIALLY_FULFILLED); trạng thái không có cạnh → CANCELLED → ORDER_INVALID_TRANSITION.
    if (current === "CANCELLED") return error(409, "ORDER_CANCELLED", "This order is cancelled");
    const lifecycle = seedLifecycle(order);
    // BE PR #150: đã đóng gói thì không huỷ — trừ hàng có sẵn đóng trước hàng in mà chưa lô nào rời kho
    if (lifecycle.packedAt !== undefined && !packedOnlyAheadOfPrints(current, lifecycle)) {
      return error(
        409,
        "ORDER_NOT_CANCELLABLE",
        "This order is packed; it can no longer be cancelled - raise a return instead",
      );
    }
    if (!CANCELLABLE_STATUSES.includes(current)) {
      return error(
        409,
        "ORDER_INVALID_TRANSITION",
        `Order ${order.orderNumber} cannot move to CANCELLED from ${current}`,
      );
    }

    setMockOrderStatus(order.orderId, "CANCELLED");
    return ok(null);
  });

  // GET /orders/:id/history — BE `OrderStatusChangeResponse` (BE PR #150): mỗi mục có `type`. Mock không giữ
  // nhật ký đổi trạng thái; chỉ có bước đặt đơn + các quyết định giao một phần Sales đã ghi.
  registerMockRoute("GET", "/orders/:id/history", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const order = orders.find((o) => o.orderId === idParam(config));
    if (!order) return error(404, "NOT_FOUND", "Resource not found");
    const state = seedLifecycle(order);
    return ok([
      { type: "STATUS_CHANGE", from: null, to: "PENDING_PAYMENT", occurredAt: order.placedAt },
      ...state.decisions.map((decision) => ({
        type: "PARTIAL_SHIPMENT_DECISION",
        from: null,
        to: null,
        reason: decision.note,
        occurredAt: decision.decidedAt,
        actorId: MOCK_SALES_ACTOR.id,
        actorName: MOCK_SALES_ACTOR.name,
        partialShipmentAllowed: decision.allowed,
      })),
    ]);
  });

  // PUT /orders/:id/partial-shipment {allowed, note?} — BE `sales-order-partial-shipments:UPDATE` (BE PR #150)
  registerMockRoute("PUT", "/orders/:id/partial-shipment", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const order = orders.find((o) => o.orderId === idParam(config));
    if (!order) return error(404, "NOT_FOUND", "Resource not found");
    const body = readBody(config.data);
    const note = readBodyString(config.data, "note");
    if (typeof body.allowed !== "boolean") return validation("allowed", "allowed is required");
    if (note.length > 500) return validation("note", "note is at most 500 characters");

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

  registerLifecycleRoutes();
}

/* ── Giữ / gỡ giữ / giao thất bại / đóng phần còn lại (BE PR #133) ───── */

function validation(field: string, message: string) {
  return error(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message }]);
}

/** Lô còn ở hãng / đã có kết quả → trạng thái đơn theo các lô (BE `Order#followShipments`). */
function statusFromShipments(shipments: readonly MockShipment[]): BackendOrderStatus {
  if (shipments.some((s) => s.status === "HANDED_OVER")) return "SHIPPED";
  if (shipments.every((s) => s.status === "DELIVERED")) return "DELIVERED";
  if (shipments.some((s) => s.status === "DELIVERY_FAILED")) return "DELIVERY_FAILED";
  return "RETURNED";
}

function registerLifecycleRoutes(): void {
  const load = async (config: AxiosRequestConfig) => {
    const { orders } = await import("@/lib/mock-data");
    const order = orders.find((o) => o.orderId === idParam(config));
    return order ? { order, state: seedLifecycle(order), current: backendStatus(order) } : null;
  };
  const invalid = (order: Order, current: string, to: string) =>
    error(
      409,
      "ORDER_INVALID_TRANSITION",
      `Order ${order.orderNumber} cannot move from ${current} to ${to}`,
    );

  // POST /orders/:id/hold {reasonCode, note?} — sales-orders:APPROVE
  registerMockRoute("POST", "/orders/:id/hold", async (config) => {
    const found = await load(config);
    if (!found) return error(404, "NOT_FOUND", "Resource not found");
    const reasonCode = readBodyString(config.data, "reasonCode");
    const note = readBodyString(config.data, "note");
    if (!MANUAL_HOLD_REASONS.includes(reasonCode))
      return validation("reasonCode", "reasonCode is not allowed");
    if (reasonCode === "OTHER" && !note) return validation("note", "A hold for OTHER must say why");
    if (!HOLDABLE_STATUSES.includes(found.current))
      return invalid(found.order, found.current, "ON_HOLD");
    found.state.status = "ON_HOLD";
    found.state.holdReason = reasonCode;
    found.state.statusBeforeHold = found.current;
    found.state.holdNote = note || undefined;
    return ok(toOrderResponse(found.order));
  });

  // POST /orders/:id/hold/resolution {note} — sales-orders:APPROVE
  registerMockRoute("POST", "/orders/:id/hold/resolution", async (config) => {
    const found = await load(config);
    if (!found) return error(404, "NOT_FOUND", "Resource not found");
    const note = readBodyString(config.data, "note");
    if (found.current !== "ON_HOLD") {
      return error(409, "ORDER_NOT_ON_HOLD", "This order is not on hold");
    }
    if (found.state.holdReason === "CREDIT" || !found.state.statusBeforeHold) {
      return error(
        409,
        "ORDER_CREDIT_HOLD_USE_APPROVAL",
        "A credit hold is decided through credit approval",
      );
    }
    if (found.state.holdReason === "DESIGN_MISMATCH") {
      return error(
        409,
        "ORDER_DESIGN_HOLD_USE_REVERIFICATION",
        "A design hold is resolved by reverifying the package",
      );
    }
    if (!note) return validation("note", "note is required");
    setMockOrderStatus(found.order.orderId, found.state.statusBeforeHold);
    return ok(toOrderResponse(found.order));
  });

  // POST /orders/:id/delivery-failure {reasonCode, note?} — sales-orders:APPROVE
  registerMockRoute("POST", "/orders/:id/delivery-failure", async (config) => {
    const found = await load(config);
    if (!found) return error(404, "NOT_FOUND", "Resource not found");
    const reasonCode = readBodyString(config.data, "reasonCode");
    const note = readBodyString(config.data, "note");
    if (!DELIVERY_FAILURE_REASONS.includes(reasonCode))
      return validation("reasonCode", "reasonCode is not allowed");
    if (reasonCode === "OTHER" && !note)
      return validation("note", "A failed delivery for OTHER must say why");
    if (found.state.shipments?.length) {
      return error(
        409,
        "ORDER_DELIVERY_VIA_SHIPMENT",
        "This order's delivery is recorded per shipment",
      );
    }
    if (found.current === "DELIVERY_FAILED") return ok(toOrderResponse(found.order));
    if (found.current !== "SHIPPED" && found.current !== "PARTIALLY_FULFILLED") {
      return invalid(found.order, found.current, "DELIVERY_FAILED");
    }
    found.state.status = "DELIVERY_FAILED";
    found.state.deliveryFailureReason = reasonCode;
    return ok(toOrderResponse(found.order));
  });

  // POST /orders/:id/remainder-closure {reasonCode, note?, agreedFee?} — sales-order-cancellations:UPDATE
  registerMockRoute("POST", "/orders/:id/remainder-closure", async (config) => {
    const found = await load(config);
    if (!found) return error(404, "NOT_FOUND", "Resource not found");
    const reasonCode = readBodyString(config.data, "reasonCode");
    const note = readBodyString(config.data, "note");
    if (!CANCELLATION_REASONS.includes(reasonCode))
      return validation("reasonCode", "reasonCode is not allowed");
    if (reasonCode === "OTHER" && !note)
      return validation("note", "Closing the rest for OTHER must say why");
    if (found.current !== "PARTIALLY_FULFILLED") {
      return invalid(found.order, found.current, "a closed remainder");
    }
    const shipments = found.state.shipments ?? [];
    const leftOf = (line: Order["lines"][number]) => {
      const shipped = shipments
        .flatMap((shipment) => shipment.lines)
        .filter((l) => l.lineId === line.lineId)
        .reduce((sum, l) => sum + l.quantity, 0);
      return line.quantity - (found.state.closedUnits[line.lineId] ?? 0) - shipped;
    };

    // Phí đã thoả thuận (BE PR #150, `Order#requireRemainderFee`): chỉ khi hàng in đã in; > 0, nguyên VND,
    // lý do ≤ 500 + chi tiết ≤ 2000 bắt buộc, tối đa giá trị phần hàng in bị đóng. Kiểm tra trước khi đổi gì.
    const fee = readBody(config.data).agreedFee;
    if (fee !== undefined && fee !== null) {
      // Mock coi đơn có dòng in là đã bắt đầu in (mock-data không có mốc bắt đầu in)
      if (!hasPrintLines(found.order)) {
        return error(
          409,
          "CANCELLATION_FEE_BEFORE_PRINTING",
          `Order ${found.order.orderNumber} has not started printing: its rest is closed without a fee`,
        );
      }
      const body = typeof fee === "object" ? (fee as Record<string, unknown>) : {};
      const amount = body.amount;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      const detail = typeof body.detail === "string" ? body.detail.trim() : "";
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0)
        return validation("agreedFee.amount", "The agreed amount is more than zero, in whole VND");
      const closedPrints = found.order.lines
        .filter((line) => line.designId)
        .reduce((sum, line) => sum + Math.max(0, leftOf(line)) * line.unitPrice, 0);
      if (amount > closedPrints) {
        return error(
          400,
          "VALIDATION_FAILED",
          `The agreed amount is at most the value of the print units closed, ${closedPrints} VND`,
        );
      }
      if (!reason || reason.length > 500 || !detail || detail.length > 2000)
        return validation(
          "agreedFee",
          "An agreed amount needs its reason (at most 500 characters) and its detail (at most 2000)",
        );
    }

    for (const line of found.order.lines) {
      const left = leftOf(line);
      if (left > 0)
        found.state.closedUnits[line.lineId] = (found.state.closedUnits[line.lineId] ?? 0) + left;
    }
    // Không có lô nào (đơn chưa giao gì) → không còn gì để theo: BE theo lô; mock giữ trạng thái cũ
    if (shipments.length) found.state.status = statusFromShipments(shipments);
    return ok(toOrderResponse(found.order));
  });
}
