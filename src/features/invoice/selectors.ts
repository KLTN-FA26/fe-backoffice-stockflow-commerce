/**
 * Invoice — selectors (pure derivations).
 *
 * KPI / join lookup / filter / format.
 * Source: docs/warehouse/04-invoice §3–§4.
 */

import { INVOICE_STATUSES, INVOICE_STATUS } from "@/constants";
import { formatCompact, formatMoney } from "@/lib/format";

import type { Invoice, InvoiceLine, InvoiceStatus } from "./types";

export { formatMoney };
export { formatCompact as formatCompactCurrency };

/* ── List-level stats ────────────────────────────────────────────────── */

export interface InvoiceListStats {
  total: number;
  draft: number;
  matched: number;
  exception: number;
  disputed: number;
  approvedForPayment: number;
  paid: number;
  cancelled: number;
  totalValueVND: number;
  totalValueUSD: number;
  valueByStatus: Record<InvoiceStatus, Record<string, number>>;
}

/**
 * Compute stats from a list of invoices.
 * Pure function — used by InvoiceList component.
 */
export function computeInvoiceStats(list: readonly Invoice[]): InvoiceListStats {
  const result: InvoiceListStats = {
    total: list.length,
    draft: 0,
    matched: 0,
    exception: 0,
    disputed: 0,
    approvedForPayment: 0,
    paid: 0,
    cancelled: 0,
    totalValueVND: 0,
    totalValueUSD: 0,
    valueByStatus: Object.fromEntries(INVOICE_STATUSES.map((status) => [status, {}])) as Record<
      InvoiceStatus,
      Record<string, number>
    >,
  };

  for (const inv of list) {
    result.valueByStatus[inv.status][inv.currency] =
      (result.valueByStatus[inv.status][inv.currency] ?? 0) + inv.grandTotal;
    switch (inv.status) {
      case INVOICE_STATUS.DRAFT:
        result.draft++;
        break;
      case INVOICE_STATUS.MATCHED:
        result.matched++;
        break;
      case INVOICE_STATUS.EXCEPTION:
        result.exception++;
        break;
      case INVOICE_STATUS.DISPUTED:
        result.disputed++;
        break;
      case INVOICE_STATUS.APPROVED_FOR_PAYMENT:
        result.approvedForPayment++;
        break;
      case INVOICE_STATUS.PAID:
        result.paid++;
        break;
      case INVOICE_STATUS.CANCELLED:
        result.cancelled++;
        break;
    }

    if (inv.currency === "VND") {
      result.totalValueVND += inv.grandTotal;
    } else if (inv.currency === "USD") {
      result.totalValueUSD += inv.grandTotal;
    }
  }

  return result;
}

/* ── Row-level UI helpers ────────────────────────────────────────────── */

/** Statuses that should flag a row in the list table. */
const FLAGGED_STATUSES: readonly InvoiceStatus[] = [
  INVOICE_STATUS.EXCEPTION,
  INVOICE_STATUS.DISPUTED,
];

export function shouldFlagInvoiceRow(inv: Invoice): boolean {
  return FLAGGED_STATUSES.includes(inv.status);
}

/* ── Line-level variance helpers ─────────────────────────────────────── */

export type VarianceType = "quantity" | "price" | "over-invoice" | "uninvoiced-receipt";

export interface VarianceItem {
  lineId: string;
  skuId: string;
  type: VarianceType;
  label: string;
  detail: string;
}

/**
 * Classify variance for a single invoice line.
 * docs §4: "quantity variance / price variance / over-invoice / uninvoiced receipt"
 */
export function classifyLineVariance(line: InvoiceLine): VarianceItem[] {
  const variances: VarianceItem[] = [];
  const { match } = line;

  if (match.varianceQty !== 0) {
    if (match.qtyInvoice > match.qtyReceipt) {
      variances.push({
        lineId: line.lineId,
        skuId: line.skuId,
        type: "over-invoice",
        label: "Over-invoice",
        detail: `SL hoá đơn (${match.qtyInvoice.toLocaleString("vi-VN")}) > SL nhận (${match.qtyReceipt.toLocaleString("vi-VN")}), chênh lệch +${match.varianceQty.toLocaleString("vi-VN")}`,
      });
    } else {
      variances.push({
        lineId: line.lineId,
        skuId: line.skuId,
        type: "quantity",
        label: "Quantity variance",
        detail: `SL hoá đơn (${match.qtyInvoice.toLocaleString("vi-VN")}) ≠ SL nhận (${match.qtyReceipt.toLocaleString("vi-VN")}), chênh lệch ${match.varianceQty.toLocaleString("vi-VN")}`,
      });
    }
  }

  if (match.variancePrice !== 0) {
    variances.push({
      lineId: line.lineId,
      skuId: line.skuId,
      type: "price",
      label: "Price variance",
      detail: `Đơn giá hoá đơn (${match.priceInvoice.toLocaleString("vi-VN")}) ≠ đơn giá PO (${match.pricePo.toLocaleString("vi-VN")}), chênh lệch ${match.variancePrice > 0 ? "+" : ""}${match.variancePrice.toLocaleString("vi-VN")}`,
    });
  }

  return variances;
}

/**
 * Collect all variances across all invoice lines.
 */
export function collectVariances(invoice: Invoice): VarianceItem[] {
  return invoice.lines.flatMap(classifyLineVariance);
}

/* ── Match line status label ─────────────────────────────────────────── */

export function lineMatchLabel(line: InvoiceLine): "Matched" | "Exception" {
  return line.match.withinTolerance ? "Matched" : "Exception";
}

/* ── Timeline ────────────────────────────────────────────────────────── */

export interface InvoiceTimelineStep {
  status: InvoiceStatus;
  label: string;
  active: boolean;
  completed: boolean;
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  "Approved for Payment": "Duyệt thanh toán",
  Cancelled: "Đã huỷ",
  Disputed: "Tranh chấp",
  Draft: "Nháp",
  Exception: "Ngoại lệ",
  Matched: "Khớp",
  Paid: "Đã thanh toán",
};

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Build timeline for invoice lifecycle.
 * Cancelled and Disputed are branches.
 */
export function buildInvoiceTimeline(status: InvoiceStatus): InvoiceTimelineStep[] {
  if (status === "Cancelled") {
    return [
      { status: "Draft", label: "Nháp", active: false, completed: true },
      { status: "Cancelled", label: "Đã huỷ", active: true, completed: true },
    ];
  }

  // Normal flow: Draft → Matched/Exception → Approved for Payment → Paid
  // Disputed is a branch from Exception
  const normalFlow: InvoiceStatus[] = [
    "Draft",
    "Exception",
    "Matched",
    "Approved for Payment",
    "Paid",
  ];

  if (status === "Disputed") {
    return [
      { status: "Draft", label: "Nháp", active: false, completed: true },
      { status: "Exception", label: "Ngoại lệ", active: false, completed: true },
      { status: "Disputed", label: "Tranh chấp", active: true, completed: true },
    ];
  }

  const currentIndex = normalFlow.indexOf(status);

  return normalFlow.map((item, index) => ({
    status: item,
    label: STATUS_LABELS[item],
    active: item === status,
    completed: currentIndex >= index,
  }));
}
