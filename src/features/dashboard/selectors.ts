import { DASHBOARD_ALERT_KIND_LABELS, DASHBOARD_LABELS } from "@/constants/dashboard";

import type { AlertSummary } from "./types";

/** Total of open alerts across kinds (the summary is "open, not resolved" per kind). */
export function totalOpenAlerts(summary: AlertSummary): number {
  return Object.values(summary.openByKind).reduce((sum, value) => sum + value, 0);
}

/** One line per kind that has alerts, e.g. "Sắp hết hạn 3 · Đã hết hạn 1". Newer kinds are shown by code. */
export function alertBreakdown(summary: AlertSummary): string {
  return Object.entries(summary.openByKind)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${DASHBOARD_ALERT_KIND_LABELS[kind] ?? kind} ${count}`)
    .join(" · ");
}

export function alertKindLabel(kind: string): string {
  return DASHBOARD_ALERT_KIND_LABELS[kind] ?? kind;
}

export function alertWarehouseLabel(warehouseCode: string | null | undefined): string {
  return warehouseCode || DASHBOARD_LABELS.alertAllWarehouses;
}
