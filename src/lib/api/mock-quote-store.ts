/**
 * Báo giá theo thùng (WF-02 pha A) — store in-memory + hình response của BE (`QuoteService.view`, `QuoteWebMapper`,
 * origin/develop). Seed: `QT-20261120-9001` (V20261124000600 §5, đã chuyển thành `SO-20261120-900001`) và
 * `QT-20261202-9002` (V20261203000100 §1, đã chuyển thành `SO-20261202-900002`); ngày tính lùi từ bây giờ như seed tính
 * từ `NOW()`. Luật lập / sửa / gửi / trả lời / chuyển đơn ở `mock-quote-rules.ts`.
 */

import { WF02_SEED_ORDERS, findWf02Order, orderTotal } from "./mock-contract-orders";
import { percentOf } from "./mock-quote-money";
import {
  WF02_DEMO_CUSTOMER_ID,
  WF02_TSM_CUSTOMER_ID,
  WF02_USERS,
  TSM_SKU,
  XANH_SKU,
  addDays,
  instantFromNow,
  taxRateOn,
  vnDay,
} from "./mock-quote-seed";

import type { QuoteApiStatus, QuoteFeeKind } from "@/constants";

export interface MockQuoteTier {
  minQuantity: number;
  unitPrice: number;
}

export interface MockQuoteLine {
  id: string;
  lineNo: number;
  sku: string;
  cartons: number;
  unitsPerCarton: number;
  /** Sắp tăng dần theo `minQuantity`; rỗng = chưa định giá (BE `QuoteLine.priced`). */
  tiers: MockQuoteTier[];
  taxClass: string | null;
  taxRate: number | null;
  acceptedCartons: number | null;
  acceptedUnitPrice: number | null;
}

export interface MockQuoteFee {
  id: string;
  kind: QuoteFeeKind;
  sku: string | null;
  /** null = phí khuôn hệ thống tự thêm, Sale chưa nhập tiền (14 BR-17). */
  amount: number | null;
  taxClass: string | null;
  taxRate: number | null;
}

export interface MockQuoteTransition {
  revision: number;
  fromStatus: QuoteApiStatus | null;
  toStatus: QuoteApiStatus;
  reason: string | null;
  changedAt: string;
  changedBy: string | null;
}

export interface MockQuote {
  id: string;
  quoteNumber: string;
  requestId: string;
  customerId: string;
  status: QuoteApiStatus;
  revision: number;
  validUntil: string;
  terms: string | null;
  requestedDeliveryDate: string | null;
  lines: MockQuoteLine[];
  fees: MockQuoteFee[];
  sentAt: string | null;
  sentBy: string | null;
  respondedAt: string | null;
  respondedBy: string | null;
  customerFeedback: string | null;
  cancellationReason: string | null;
  convertedOrderId: string | null;
  convertedAt: string | null;
  history: MockQuoteTransition[];
  createdAt: string;
  createdBy: string;
  /** JPA `@Version`: 0 khi lập, +1 mỗi lần lưu. */
  version: number;
}

/* ── Giá (BE `QuoteLine`) ────────────────────────────────────────────── */

/** MOQ = bậc giá thấp nhất (14 BR-07). */
export const moqOf = (line: Pick<MockQuoteLine, "tiers">): number | null =>
  line.tiers[0]?.minQuantity ?? null;

/** Đơn giá một cái ở `cartons` thùng: bậc có điểm bắt đầu cao nhất không vượt `cartons` (gọi khi đã ≥ MOQ). */
export function priceFor(line: Pick<MockQuoteLine, "tiers">, cartons: number): number | null {
  let price: number | null = null;
  for (const tier of line.tiers) if (tier.minQuantity <= cartons) price = tier.unitPrice;
  return price;
}

/** Thùng đề xuất của một SKU trên cả báo giá (mỗi SKU một dòng, 14 BR-22). */
export const cartonsOfSku = (
  lines: readonly Pick<MockQuoteLine, "sku" | "cartons">[],
  sku: string,
) => lines.filter((line) => line.sku === sku).reduce((sum, line) => sum + line.cartons, 0);

/** BE `Quote.statusAt`: báo giá đã gửi quá hạn hiệu lực đọc là EXPIRED. */
export const statusAt = (quote: MockQuote, now: number = Date.now()): QuoteApiStatus =>
  quote.status === "SENT" && now >= Date.parse(quote.validUntil) ? "EXPIRED" : quote.status;

/* ── Seed ────────────────────────────────────────────────────────────── */

const SEED_TERMS = "Giá đã gồm in 2 màu; giao theo đợt trong hợp đồng.";

function seed(): MockQuote[] {
  const delivery = addDays(vnDay(), 21);
  const history = (
    sentAt: string,
    respondedAt: string,
    customerUser: string,
    convertedAt: string,
    orderNumber: string,
    createdAt: string,
  ): MockQuoteTransition[] => [
    {
      revision: 1,
      fromStatus: null,
      toStatus: "DRAFT",
      reason: null,
      changedAt: createdAt,
      changedBy: WF02_USERS.sales,
    },
    {
      revision: 1,
      fromStatus: "DRAFT",
      toStatus: "SENT",
      reason: null,
      changedAt: sentAt,
      changedBy: WF02_USERS.sales,
    },
    {
      revision: 1,
      fromStatus: "SENT",
      toStatus: "ACCEPTED",
      reason: null,
      changedAt: respondedAt,
      changedBy: customerUser,
    },
    {
      revision: 1,
      fromStatus: "ACCEPTED",
      toStatus: "CONVERTED",
      reason: orderNumber,
      changedAt: convertedAt,
      changedBy: WF02_USERS.sales,
    },
  ];
  const demo = {
    created: instantFromNow(-6 * 24),
    sent: instantFromNow(-6 * 24 + 3),
    responded: instantFromNow(-5 * 24),
    converted: instantFromNow(-4 * 24),
  };
  const tsm = {
    created: instantFromNow(-3 * 24),
    sent: instantFromNow(-3 * 24 + 1),
    responded: instantFromNow(-2 * 24),
    converted: instantFromNow(-24),
  };
  return [
    {
      id: "1600be93-80dd-a049-8727-200af2bff2b2",
      quoteNumber: "QT-20261120-9001",
      requestId: "c854ee54-fab5-e741-b0d1-5060f36af666",
      customerId: WF02_DEMO_CUSTOMER_ID,
      status: "CONVERTED",
      revision: 1,
      validUntil: instantFromNow(8 * 24),
      terms: SEED_TERMS,
      requestedDeliveryDate: delivery,
      lines: [
        {
          id: "da6509fe-e845-7288-d06c-59c021d25059",
          lineNo: 1,
          sku: XANH_SKU,
          cartons: 60,
          unitsPerCarton: 1000,
          tiers: [
            { minQuantity: 20, unitPrice: 1250 },
            { minQuantity: 50, unitPrice: 1150 },
            { minQuantity: 100, unitPrice: 1050 },
          ],
          // V20261124000600 ghi cứng VAT 10% trên dòng và phí
          taxClass: "STANDARD",
          taxRate: 10,
          acceptedCartons: 60,
          acceptedUnitPrice: 1150,
        },
      ],
      fees: [
        {
          id: "701bfb4e-89d8-7382-1816-c5a04c5652a0",
          kind: "PLATE_FEE",
          sku: XANH_SKU,
          amount: 1_500_000,
          taxClass: "STANDARD",
          taxRate: 10,
        },
      ],
      sentAt: demo.sent,
      sentBy: WF02_USERS.sales,
      respondedAt: demo.responded,
      respondedBy: WF02_USERS.demoCustomer,
      customerFeedback: null,
      cancellationReason: null,
      convertedOrderId: WF02_SEED_ORDERS.demo.orderId,
      convertedAt: demo.converted,
      history: history(
        demo.sent,
        demo.responded,
        WF02_USERS.demoCustomer,
        demo.converted,
        WF02_SEED_ORDERS.demo.orderNumber,
        demo.created,
      ),
      createdAt: demo.created,
      createdBy: "flyway",
      version: 3,
    },
    {
      id: "7a274b2e-a638-5f4d-9054-6f1cf706b719",
      quoteNumber: "QT-20261202-9002",
      requestId: "d972c03f-486c-a3cc-a022-c34b225694fd",
      customerId: WF02_TSM_CUSTOMER_ID,
      status: "CONVERTED",
      revision: 1,
      validUntil: instantFromNow(10 * 24),
      terms: SEED_TERMS,
      requestedDeliveryDate: delivery,
      lines: [
        {
          id: "6c86b5b0-5dae-5caf-a782-54f9b85d3cba",
          lineNo: 1,
          sku: TSM_SKU,
          cartons: 60,
          unitsPerCarton: 1000,
          tiers: [
            { minQuantity: 20, unitPrice: 1300 },
            { minQuantity: 50, unitPrice: 1200 },
            { minQuantity: 100, unitPrice: 1100 },
          ],
          // V20261203000100: thuế suất STANDARD của ngày dựng DB; SKU đã sản xuất → không phí khuôn
          taxClass: "STANDARD",
          taxRate: taxRateOn("STANDARD", vnDay()),
          acceptedCartons: 60,
          acceptedUnitPrice: 1200,
        },
      ],
      fees: [],
      sentAt: tsm.sent,
      sentBy: WF02_USERS.sales,
      respondedAt: tsm.responded,
      respondedBy: WF02_USERS.tsmCustomer,
      customerFeedback: null,
      cancellationReason: null,
      convertedOrderId: WF02_SEED_ORDERS.tsm.orderId,
      convertedAt: tsm.converted,
      history: history(
        tsm.sent,
        tsm.responded,
        WF02_USERS.tsmCustomer,
        tsm.converted,
        WF02_SEED_ORDERS.tsm.orderNumber,
        tsm.created,
      ),
      createdAt: tsm.created,
      createdBy: WF02_USERS.sales,
      version: 3,
    },
  ];
}

let quotes: MockQuote[] | null = null;
export const mockQuotes = (): MockQuote[] => (quotes ??= seed());

export function resetQuoteMockStore(): void {
  quotes = null;
}

export const findMockQuote = (id: string) => mockQuotes().find((q) => q.id === id);

/** BE `QuoteRepositoryAdapter.nextNumber`: `QT-yyyyMMdd-` + số thứ tự trong ngày, 4 chữ số. */
export function nextQuoteNumber(): string {
  const prefix = `QT-${vnDay().replace(/-/g, "")}-`;
  const used = mockQuotes().filter((q) => q.quoteNumber.startsWith(prefix)).length;
  return `${prefix}${String(used + 1).padStart(4, "0")}`;
}

/* ── Response (BE `QuoteResponse`) ────────────────────────────────────── */

/** BE `TotalsBuilder`: phần nào chưa có (giá, tiền phí, thuế suất) thì tổng đó null. */
interface Totals {
  subtotal: number | null;
  fees: number | null;
  tax: number | null;
}
const add = (sum: number | null, part: number | null) =>
  sum === null || part === null ? null : sum + part;

/**
 * Tổng đủ bốn số, hoặc null. BE gửi `{subtotal}` một mình khi phí khuôn chưa có tiền (các phần null bị bỏ), nhưng
 * `totalsDtoSchema` của FE đòi đủ bốn số — mock bỏ cả khối để màn hình parse được (xem báo cáo: lệch FE ↔ BE).
 */
function complete(totals: Totals) {
  const { subtotal, fees, tax } = totals;
  return subtotal === null || fees === null || tax === null
    ? null
    : { subtotal, fees, tax, total: subtotal + fees + tax };
}

export function quoteView(quote: MockQuote) {
  // BE: báo giá đã qua nháp mà dòng thiếu thuế suất là báo giá trước 4B-3 → thuế 0; chỉ nháp mới "chưa biết"
  const untaxed = quote.status !== "DRAFT" && quote.lines.some((line) => line.taxRate === null);
  const taxOf = (net: number | null, rate: number | null) =>
    net === null ? null : untaxed ? 0 : rate === null ? null : percentOf(net, rate);
  const accepted = quote.lines.length > 0 && quote.lines.every((l) => l.acceptedCartons !== null);
  const proposedTotals: Totals = { subtotal: 0, fees: 0, tax: 0 };
  const acceptedTotals: Totals = { subtotal: 0, fees: 0, tax: 0 };
  const lines = quote.lines.map((line) => {
    const moq = moqOf(line);
    const proposedPrice = moq === null ? null : priceFor(line, cartonsOfSku(quote.lines, line.sku));
    const proposedNet =
      proposedPrice === null ? null : line.cartons * line.unitsPerCarton * proposedPrice;
    const proposedTax = taxOf(proposedNet, line.taxRate);
    const acceptedUnits =
      line.acceptedCartons === null ? null : line.acceptedCartons * line.unitsPerCarton;
    const acceptedNet =
      acceptedUnits === null || line.acceptedUnitPrice === null
        ? null
        : acceptedUnits * line.acceptedUnitPrice;
    const acceptedTax = taxOf(acceptedNet, line.taxRate);
    proposedTotals.subtotal = add(proposedTotals.subtotal, proposedNet);
    proposedTotals.tax = add(proposedTotals.tax, proposedTax);
    acceptedTotals.subtotal = add(acceptedTotals.subtotal, acceptedNet);
    acceptedTotals.tax = add(acceptedTotals.tax, acceptedTax);
    return {
      id: line.id,
      lineNo: line.lineNo,
      measure: "CARTON",
      sku: line.sku,
      cartons: line.cartons,
      unitsPerCarton: line.unitsPerCarton,
      units: line.cartons * line.unitsPerCarton,
      priced: moq !== null,
      moq,
      tiers: line.tiers,
      proposedUnitPrice: proposedPrice,
      proposedLineTotal: proposedNet,
      acceptedCartons: line.acceptedCartons,
      acceptedUnits,
      acceptedUnitPrice: line.acceptedUnitPrice,
      acceptedLineTotal: acceptedNet,
      taxClass: line.taxClass,
      taxRate: line.taxRate,
      proposedTax,
      acceptedTax,
    };
  });
  const fees = quote.fees.map((fee) => {
    const tax =
      fee.amount === null || fee.taxRate === null ? null : percentOf(fee.amount, fee.taxRate);
    for (const totals of [proposedTotals, acceptedTotals]) {
      totals.fees = add(totals.fees, fee.amount);
      totals.tax = add(totals.tax, tax);
    }
    return { ...fee, tax };
  });
  const proposed = complete(proposedTotals);
  const acceptedView = accepted ? complete(acceptedTotals) : null;
  const order = quote.convertedOrderId ? findWf02Order(quote.convertedOrderId) : undefined;
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerId: quote.customerId,
    status: statusAt(quote),
    revision: quote.revision,
    validUntil: quote.validUntil,
    terms: quote.terms,
    requestedDeliveryDate: quote.requestedDeliveryDate,
    legacy: false,
    lines,
    fees,
    priced: quote.lines.every((line) => line.tiers.length > 0),
    proposed,
    accepted: acceptedView,
    proposedTotal: proposed?.total ?? null,
    acceptedTotal: acceptedView?.total ?? null,
    sentAt: quote.sentAt,
    sentBy: quote.sentBy,
    respondedAt: quote.respondedAt,
    respondedBy: quote.respondedBy,
    customerFeedback: quote.customerFeedback,
    cancellationReason: quote.cancellationReason,
    convertedOrder: order
      ? {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          status: order.status,
          total: orderTotal(order),
        }
      : null,
    convertedAt: quote.convertedAt,
    history: quote.history,
    createdAt: quote.createdAt,
    createdBy: quote.createdBy,
    version: quote.version,
  };
}

/** BE `QuoteRowResponse` — dòng danh sách. */
export const quoteRow = (quote: MockQuote) => ({
  id: quote.id,
  quoteNumber: quote.quoteNumber,
  customerId: quote.customerId,
  status: statusAt(quote),
  revision: quote.revision,
  validUntil: quote.validUntil,
  sentAt: quote.sentAt,
  convertedOrderId: quote.convertedOrderId,
  createdAt: quote.createdAt,
  version: quote.version,
});
