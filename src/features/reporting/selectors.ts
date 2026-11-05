import { REPORT_ORDER_STATUS_TO_FE } from "@/constants/reporting";

import { statusLabelVi, toneOf } from "@/lib/status-map";

import type { SemanticTone } from "@/lib/mock-data";
import type { OrderStatusCount, SalesDaily, SalesSummary, TopProduct } from "./types";

// Same tone -> colour pairing as `StatusDot`, as CSS variables so recharts follows the theme.
const TONE_COLOR: Record<SemanticTone, string> = {
  danger: "var(--dot-danger)",
  info: "var(--dot-info)",
  muted: "var(--neutral)",
  neutral: "var(--neutral)",
  positive: "var(--dot-positive)",
  special: "var(--dot-special)",
  warning: "var(--dot-warning)",
};

function feStatus(code: string): string | undefined {
  return Object.hasOwn(REPORT_ORDER_STATUS_TO_FE, code)
    ? REPORT_ORDER_STATUS_TO_FE[code as keyof typeof REPORT_ORDER_STATUS_TO_FE]
    : undefined;
}

export interface StatusBar {
  readonly code: string;
  readonly label: string;
  readonly color: string;
  readonly count: number;
}

/** Order statuses with the shared Vietnamese label + tone; unknown BE codes keep the raw code. */
export function toStatusBars(rows: readonly OrderStatusCount[]): StatusBar[] {
  return rows.map((row) => {
    const fe = feStatus(row.status);
    return {
      code: row.status,
      label: (fe && statusLabelVi(fe, "order")) ?? row.status,
      color: TONE_COLOR[fe ? toneOf(fe) : "neutral"],
      count: row.count,
    };
  });
}

/** Whether the range holds any sales at all (drives the empty state). */
export function hasSales(daily: readonly SalesDaily[]): boolean {
  return daily.some((day) => day.ordersCount > 0 || day.revenue > 0);
}

export function topProductLabel(product: TopProduct): string {
  return product.productName ?? product.sku;
}

export interface SummaryCard {
  readonly key: "revenue" | "orders" | "averageOrderValue";
  readonly value: number;
  /** Percentage points as the BE sends them (12.5 = +12,5%); undefined hides the badge. */
  readonly change: number | undefined;
}

export function summaryCards(summary: SalesSummary): SummaryCard[] {
  return [
    { key: "revenue", value: summary.current.revenue, change: summary.revenueChangePercent },
    { key: "orders", value: summary.current.ordersCount, change: summary.ordersChangePercent },
    {
      key: "averageOrderValue",
      value: summary.current.averageOrderValue,
      change: summary.averageOrderValueChangePercent,
    },
  ];
}

/** "+12,5%" / "-3,0%" / "0,0%". */
export function formatChange(change: number): string {
  const text = Math.abs(change).toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (change > 0) return `+${text}%`;
  if (change < 0) return `-${text}%`;
  return `${text}%`;
}

/** Statuses with orders, plus ON_HOLD always (held orders need a person even when the count is 0). */
export function visibleStatusBars(bars: readonly StatusBar[]): StatusBar[] {
  return bars.filter((bar) => bar.count > 0 || bar.code === "ON_HOLD");
}
