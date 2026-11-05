/**
 * Mock routes — báo cáo bán hàng (`/reports/*`, BE PR #170). Số liệu sinh tất định theo ngày (không
 * dùng `mock-data.ts`) nhưng đúng hình dạng hợp đồng: từng ngày đủ dòng (zero-fill), top SKU xếp theo
 * doanh thu, mọi trạng thái đơn kể cả ON_HOLD, `*ChangePercent` bỏ khi kỳ trước bằng 0.
 */
import { REPORTING_API, REPORTING_LIMITS, REPORT_ORDER_STATUS_TO_FE } from "@/constants/reporting";

import { addDays, inclusiveDays, todayIso, validateRange } from "@/lib/date-range";

import { registerMockRoute } from "./mock-adapter";
import { beError, beOk } from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { DateRange } from "@/lib/date-range";

const CURRENCY = "VND";
const AVG_ORDER_VALUE = 1_250_000;

function paramsOf(config: AxiosRequestConfig): URLSearchParams {
  return new URLSearchParams(config.url?.split("?")[1] ?? "");
}

/** Default: last 30 days ending today (Asia/Ho_Chi_Minh). */
function rangeOf(config: AxiosRequestConfig): DateRange {
  const q = paramsOf(config);
  const to = q.get("to") ?? todayIso();
  return { from: q.get("from") ?? addDays(to, -(REPORTING_LIMITS.defaultRangeDays - 1)), to };
}

// Deterministic pseudo-random 0..1 per day so reloads show the same chart.
function noise(day: string): number {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) % 1009;
  return (h % 100) / 100;
}

function dailyRows(range: DateRange) {
  return Array.from({ length: inclusiveDays(range) }, (_, i) => {
    const day = addDays(range.from, i);
    const ordersCount = Math.floor(noise(day) * 14); // zero-filled days included
    return { day, ordersCount, revenue: ordersCount * AVG_ORDER_VALUE, currency: CURRENCY };
  });
}

function totals(range: DateRange) {
  const rows = dailyRows(range);
  const ordersCount = rows.reduce((sum, r) => sum + r.ordersCount, 0);
  const revenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  return {
    ordersCount,
    revenue,
    averageOrderValue: ordersCount === 0 ? 0 : Math.round(revenue / ordersCount),
  };
}

function change(current: number, previous: number): number | undefined {
  return previous === 0 ? undefined : Math.round(((current - previous) / previous) * 1000) / 10;
}

function invalid(range: DateRange) {
  return validateRange(range)
    ? beError(400, "VALIDATION_FAILED", "Khoảng ngày không hợp lệ (tối đa 366 ngày, from ≤ to)")
    : null;
}

const CATALOG: readonly { sku: string; productName?: string; unit: number }[] = [
  { sku: "SKU-TSHIRT-WHT-M", productName: "Áo thun trắng M", unit: 180_000 },
  { sku: "SKU-HOODIE-BLK-L", productName: "Áo hoodie đen L", unit: 420_000 },
  { sku: "SKU-JEANS-BLU-32", productName: "Quần jeans xanh 32", unit: 560_000 },
  { sku: "SKU-CAP-NVY", productName: "Nón lưỡi trai navy", unit: 120_000 },
  { sku: "SKU-BAG-CNV-01", unit: 340_000 }, // no name -> FE falls back to the SKU
  { sku: "SKU-SOCK-PK6", productName: "Tất cổ ngắn (6 đôi)", unit: 95_000 },
];

function topProducts(range: DateRange, limit: number) {
  const days = inclusiveDays(range);
  return CATALOG.map((item, i) => {
    const quantitySold = Math.max(0, Math.round(days * (6 - i) * (0.6 + noise(item.sku))));
    return {
      sku: item.sku,
      productName: item.productName,
      quantitySold,
      revenue: quantitySold * item.unit,
    };
  })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function registerReportMockRoutes(): void {
  registerMockRoute("GET", REPORTING_API.salesDaily, (config) => {
    const range = rangeOf(config);
    return invalid(range) ?? beOk(dailyRows(range));
  });

  registerMockRoute("GET", REPORTING_API.topProducts, (config) => {
    const range = rangeOf(config);
    const limit = Number(paramsOf(config).get("limit") ?? REPORTING_LIMITS.topProductsLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return beError(400, "VALIDATION_FAILED", "limit phải từ 1 đến 100");
    }
    return invalid(range) ?? beOk(topProducts(range, limit));
  });

  registerMockRoute("GET", REPORTING_API.orderStatusCounts, () =>
    beOk(
      Object.keys(REPORT_ORDER_STATUS_TO_FE).map((status, i) => ({
        status,
        count: status === "DRAFT" ? 0 : (i * 7 + 3) % 23,
      })),
    ),
  );

  registerMockRoute("GET", REPORTING_API.summary, (config) => {
    const range = rangeOf(config);
    const bad = invalid(range);
    if (bad) return bad;
    const days = inclusiveDays(range);
    const previous = { from: addDays(range.from, -days), to: addDays(range.from, -1) };
    const current = totals(range);
    const before = totals(previous);
    return beOk({
      ...range,
      previousFrom: previous.from,
      previousTo: previous.to,
      currency: CURRENCY,
      current,
      previous: before,
      ordersChangePercent: change(current.ordersCount, before.ordersCount),
      revenueChangePercent: change(current.revenue, before.revenue),
      averageOrderValueChangePercent: change(current.averageOrderValue, before.averageOrderValue),
    });
  });

  registerMockRoute("POST", REPORTING_API.rebuild, (config) => {
    const range = rangeOf(config);
    const bad = invalid(range);
    if (bad) return bad;
    const { ordersCount } = totals(range);
    return beOk({
      ...range,
      days: inclusiveDays(range),
      ordersSeen: ordersCount,
      ordersCounted: ordersCount,
    });
  });
}
