/**
 * Đơn bán WF-02 (đơn đặt theo thùng SKU riêng của khách, đi qua báo giá → hợp đồng) — store in-memory riêng, vì mock đơn
 * hàng cũ dựng từ `mock-data.ts` (không được sửa, không có đơn theo thùng). `mock-routes-orders.ts` hỏi store này khi id
 * không có trong mock-data (`GET /orders/:id`, `/orders/:id/history`).
 *
 * Seed: `SO-20261120-900001` (V20261124000600 §6, chờ ký hợp đồng) và `SO-20261202-900002` (V20261203000100 §2, nháp, VAT
 * theo ngày dựng DB). Đơn mới chỉ sinh khi chuyển báo giá đã chấp nhận (`placeQuotedOrder`). Vòng đời theo BE `Order`:
 * `sendContract` (DRAFT → PENDING_CONTRACT), `withdrawContract` (→ DRAFT), `contractSigned` (→ ON_HOLD/CREDIT,
 * PENDING_PAYMENT hoặc CONFIRMED), `confirmByInstallments` (đợt khi ký trả đủ → CONFIRMED, lý do `INSTALLMENT_PAID`).
 */

import { mulDivHalfUp, percentOf } from "./mock-quote-money";
import {
  WF02_TSM_CUSTOMER_ID,
  WF02_DEMO_CUSTOMER_ID,
  WF02_USERS,
  TSM_SKU,
  XANH_SKU,
  addDays,
  instantFromNow,
  taxRateOn,
  vnDay,
  wf02Customer,
  wf02MockCustomer,
} from "./mock-quote-seed";
import { mockInstallments, outstandingOf } from "./mock-payment-store";

import type { QuoteFeeKind } from "@/constants";
import type { Wf02Address } from "./mock-quote-seed";

export type Wf02OrderStatus =
  "DRAFT" | "PENDING_CONTRACT" | "PENDING_PAYMENT" | "CONFIRMED" | "ON_HOLD" | "CANCELLED";

export interface Wf02OrderLine {
  lineId: string;
  sku: string;
  cartons: number;
  unitsPerCarton: number;
  /** Số cái = thùng × cái/thùng. */
  quantity: number;
  unitPrice: number;
  taxRate: number | null;
  requestedDeliveryDate: string | null;
}

export interface Wf02OrderFee {
  kind: QuoteFeeKind;
  sku: string | null;
  amount: number;
  taxRate: number | null;
}

interface Wf02HistoryEntry {
  from: Wf02OrderStatus | null;
  to: Wf02OrderStatus;
  reason: string | null;
  occurredAt: string;
}

export interface Wf02Order {
  orderId: string;
  orderNumber: string;
  customerId: string;
  /**
   * Mã yêu cầu đặt đơn — seed: `md5('demo:wf02…:order-request')`; chuyển báo giá: suy từ id báo giá (BE
   * `QuoteService.conversionRequestId`) nên gọi lại ra cùng đơn.
   */
  requestId: string;
  status: Wf02OrderStatus;
  holdReason: "CREDIT" | null;
  lines: Wf02OrderLine[];
  fees: Wf02OrderFee[];
  placedAt: string;
  createdBy: string;
  history: Wf02HistoryEntry[];
}

/* ── Tiền của đơn (BE `OrderLine`, `Order.total`) ────────────────────── */

export const lineTotal = (line: Wf02OrderLine) => line.quantity * line.unitPrice;
export const lineTax = (line: Wf02OrderLine) =>
  line.taxRate === null ? null : percentOf(lineTotal(line), line.taxRate);
const feeTax = (fee: Wf02OrderFee) =>
  fee.taxRate === null ? null : percentOf(fee.amount, fee.taxRate);

/** Hàng + phí, chưa thuế (BE `Order.netTotal`). */
export const orderNet = (order: Wf02Order) =>
  order.lines.reduce((sum, line) => sum + lineTotal(line), 0) +
  order.fees.reduce((sum, fee) => sum + fee.amount, 0);
/** Thuế từng dòng cộng lại (14 BR-21: thuế của chứng từ là tổng thuế các dòng). */
export const orderTax = (order: Wf02Order) =>
  order.lines.reduce((sum, line) => sum + (lineTax(line) ?? 0), 0) +
  order.fees.reduce((sum, fee) => sum + (feeTax(fee) ?? 0), 0);
export const orderTotal = (order: Wf02Order) => orderNet(order) + orderTax(order);

/** BE `OrderLine.grossOf`: `units` cái đầu của dòng có thuế, chia theo tỉ lệ, cả dòng cộng lại đúng bằng tổng có thuế. */
export function grossOf(line: Wf02OrderLine, units: number): number {
  const tax = lineTax(line);
  if (tax === null) return line.unitPrice * units;
  const gross = lineTotal(line) + tax;
  if (units === line.quantity) return gross;
  return mulDivHalfUp(gross, units, line.quantity);
}

/* ── Seed ────────────────────────────────────────────────────────────── */

export const WF02_SEED_ORDERS = {
  demo: { orderId: "18a05a36-cbcf-93d9-afb5-7b69d242383d", orderNumber: "SO-20261120-900001" },
  tsm: { orderId: "1785be93-d755-21a3-9225-b7976f32012c", orderNumber: "SO-20261202-900002" },
} as const;
export const WF02_SEED_ORDER_LINES = {
  demo: "e9d61643-0a71-e41b-48c7-fad4a80bdbeb",
  tsm: "d3040641-35a3-85ca-b5ba-b5d5d3d5268c",
} as const;

function seed(): Wf02Order[] {
  const today = vnDay();
  const delivery = addDays(today, 21);
  return [
    {
      ...WF02_SEED_ORDERS.demo,
      customerId: WF02_DEMO_CUSTOMER_ID,
      requestId: "c47e5d64-eef5-b027-b1dc-4f5abee61bb5",
      status: "PENDING_CONTRACT",
      holdReason: null,
      // V20261124000600 §6: 60 thùng × 1.000 × 1.150, VAT 10% (thuế suất ghi cứng trong seed) + phí khuôn 1.500.000
      lines: [
        {
          lineId: WF02_SEED_ORDER_LINES.demo,
          sku: XANH_SKU,
          cartons: 60,
          unitsPerCarton: 1000,
          quantity: 60_000,
          unitPrice: 1150,
          taxRate: 10,
          requestedDeliveryDate: delivery,
        },
      ],
      fees: [{ kind: "PLATE_FEE", sku: XANH_SKU, amount: 1_500_000, taxRate: 10 }],
      placedAt: instantFromNow(-4 * 24),
      createdBy: "flyway",
      history: [
        {
          from: null,
          to: "DRAFT",
          reason: "Chuyển từ báo giá QT-20261120-9001",
          occurredAt: instantFromNow(-4 * 24),
        },
        {
          from: "DRAFT",
          to: "PENDING_CONTRACT",
          reason: "Đã gửi hợp đồng HD-20261120-900001-1",
          occurredAt: instantFromNow(-2 * 24),
        },
      ],
    },
    {
      ...WF02_SEED_ORDERS.tsm,
      customerId: WF02_TSM_CUSTOMER_ID,
      requestId: "723ec7e6-75b0-2a69-20d9-d0911daa8a56",
      status: "DRAFT",
      holdReason: null,
      // V20261203000100 §2: 60 thùng × 1.000 × 1.200 = 72.000.000, VAT STANDARD của ngày dựng DB (8% tới hết 2026)
      lines: [
        {
          lineId: WF02_SEED_ORDER_LINES.tsm,
          sku: TSM_SKU,
          cartons: 60,
          unitsPerCarton: 1000,
          quantity: 60_000,
          unitPrice: 1200,
          taxRate: taxRateOn("STANDARD", today),
          requestedDeliveryDate: delivery,
        },
      ],
      fees: [],
      placedAt: instantFromNow(-24),
      createdBy: WF02_USERS.sales,
      history: [
        {
          from: null,
          to: "DRAFT",
          reason: "Chuyển từ báo giá QT-20261202-9002",
          occurredAt: instantFromNow(-24),
        },
      ],
    },
  ];
}

let orders: Wf02Order[] | null = null;
const store = () => (orders ??= seed());

export function resetWf02OrderMockStore(): void {
  orders = null;
}

/** Ghi một bước chuyển trạng thái như BE `Order#transitionTo`. */
function moveTo(order: Wf02Order, to: Wf02OrderStatus, reason: string): void {
  order.history.push({ from: order.status, to, reason, occurredAt: new Date().toISOString() });
  order.status = to;
  if (to !== "ON_HOLD") order.holdReason = null;
}

/**
 * BE `Order#confirmByInstallments` (15 §4.2): đơn chờ thanh toán, mọi đợt khi ký đã trả đủ → CONFIRMED. BE chạy khi ghi
 * phiếu thu; mock xét lại lúc đọc đơn, để mock phiếu thu (`mock-routes-payment.ts`) không phải biết đơn WF-02.
 */
function confirmByInstallments(order: Wf02Order): void {
  if (order.status !== "PENDING_PAYMENT") return;
  const onSigning = mockInstallments().filter(
    (i) => i.orderId === order.orderId && i.milestone === "ON_SIGNING" && !i.cancelled,
  );
  if (onSigning.length > 0 && onSigning.every((i) => outstandingOf(i) === 0))
    moveTo(order, "CONFIRMED", "INSTALLMENT_PAID");
}

export function findWf02Order(orderId: string): Wf02Order | undefined {
  const order = store().find((o) => o.orderId === orderId);
  if (order) confirmByInstallments(order);
  return order;
}

/** 14 §4.3 bước 13: gửi hợp đồng → đơn chờ ký (BE `Order#sendContract`). */
export function sendContractOf(order: Wf02Order): void {
  if (order.status === "DRAFT") moveTo(order, "PENDING_CONTRACT", "CONTRACT_SENT");
}

/** 14 §4.3 bước 16: huỷ hợp đồng để lập lại → đơn về nháp (BE `Order#withdrawContract`). */
export function withdrawContractOf(order: Wf02Order): void {
  if (order.status === "PENDING_CONTRACT") moveTo(order, "DRAFT", "CONTRACT_CANCELLED");
}

/** 14 §4.3 bước 15 (BE `Order#contractSigned`): giữ chờ duyệt tín dụng / chờ đợt khi ký / xác nhận. */
export function contractSignedOf(order: Wf02Order, creditHold: boolean, paysOnSigning: boolean) {
  order.placedAt = new Date().toISOString();
  if (creditHold) {
    moveTo(order, "ON_HOLD", "CREDIT");
    order.holdReason = "CREDIT";
  } else {
    moveTo(order, paysOnSigning ? "PENDING_PAYMENT" : "CONFIRMED", "CONTRACT_SIGNED");
  }
}

/** BE `OrderNumber`: `SO-yyyyMMdd-` + số thứ tự trong ngày, 6 chữ số. */
function nextOrderNumber(): string {
  const prefix = `SO-${vnDay().replace(/-/g, "")}-`;
  const used = store().filter((o) => o.orderNumber.startsWith(prefix)).length;
  return `${prefix}${String(used + 1).padStart(6, "0")}`;
}

export interface QuotedOrderCommand {
  requestId: string;
  customerId: string;
  quoteNumber: string;
  lines: Omit<Wf02OrderLine, "lineId">[];
  fees: Wf02OrderFee[];
}

/** BE `QuotedOrders.placeQuotedOrder`: đơn NHÁP, chưa giữ hàng (14 §4.2); cùng `requestId` → cùng đơn. */
export function placeQuotedOrder(command: QuotedOrderCommand): Wf02Order {
  const earlier = store().find((o) => o.requestId === command.requestId);
  if (earlier) return earlier;
  const now = new Date().toISOString();
  const order: Wf02Order = {
    orderId: crypto.randomUUID(),
    orderNumber: nextOrderNumber(),
    customerId: command.customerId,
    requestId: command.requestId,
    status: "DRAFT",
    holdReason: null,
    lines: command.lines.map((line) => ({ ...line, lineId: crypto.randomUUID() })),
    fees: command.fees,
    placedAt: now,
    createdBy: WF02_USERS.sales,
    history: [
      {
        from: null,
        to: "DRAFT",
        reason: `Chuyển từ báo giá ${command.quoteNumber}`,
        occurredAt: now,
      },
    ],
  };
  store().push(order);
  return order;
}

/* ── Response (BE `OrderResponse`, 4B-3) ──────────────────────────────── */

const addressWire = (a: Wf02Address | undefined) =>
  a
    ? {
        recipientName: a.recipientName,
        phone: a.phone,
        line1: a.line1,
        wardCode: a.wardCode,
        wardName: a.wardName,
        provinceCode: a.provinceCode,
        provinceName: a.provinceName,
        countryCode: a.countryCode,
      }
    : null;

export function wf02OrderResponse(order: Wf02Order) {
  const customer = wf02Customer(order.customerId);
  const profile = wf02MockCustomer(order.customerId);
  const total = orderTotal(order);
  const held = order.status === "ON_HOLD" ? order.holdReason : null;
  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customerName: profile?.fullName ?? null,
    customerCode: profile?.taxCode ?? null,
    status: order.status,
    totalAmount: total,
    currency: "VND",
    lines: order.lines.map((line) => ({
      lineId: line.lineId,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: lineTotal(line),
      // Đơn WF-02 chỉ giữ hàng sau khi xác nhận (F-04.3); mock chưa đi tới bước đó
      reservationIds: [],
      shippedQuantity: 0,
      deliveredQuantity: 0,
      cancelledQuantity: 0,
      requestedDeliveryDate: line.requestedDeliveryDate,
      cartons: line.cartons,
      unitsPerCarton: line.unitsPerCarton,
      taxRate: line.taxRate,
      taxAmount: lineTax(line),
    })),
    placedAt: order.placedAt,
    createdBy: order.createdBy,
    contactName: customer?.contact.name ?? null,
    contactEmail: customer?.contact.email ?? null,
    contactPhone: customer?.contact.phone ?? null,
    shippingAddress: addressWire(customer?.shipping),
    billingAddress: addressWire(customer?.billing),
    holdReason: held,
    holdReasonPublic: held === "CREDIT" ? "AWAITING_CREDIT_APPROVAL" : null,
    effectiveTotal: total,
    shipments: [],
    allowPartialShipment: false,
    printLinesReady: true,
    netAmount: orderNet(order),
    taxAmount: orderTax(order),
    fees: order.fees.map((fee) => ({
      kind: fee.kind,
      sku: fee.sku,
      amount: fee.amount,
      taxRate: fee.taxRate,
      taxAmount: feeTax(fee),
    })),
  };
}

/** `GET /orders/:id/history` — cùng hình mục `STATUS_CHANGE` của mock đơn hàng. */
export const wf02OrderHistory = (order: Wf02Order) =>
  order.history.map((entry) => ({ type: "STATUS_CHANGE", ...entry }));
