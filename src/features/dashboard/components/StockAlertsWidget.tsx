"use client";

import { AlertTriangle } from "lucide-react";

import { DASHBOARD_ALERT_PERMISSION, DASHBOARD_LABELS } from "@/constants/dashboard";

import { formatDateTime } from "@/lib/format/date";
import { useCan } from "@/lib/auth";

import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useOpenAlerts } from "../queries";
import { alertKindLabel, alertWarehouseLabel } from "../selectors";

const L = DASHBOARD_LABELS;

/** Open stock alerts (BE `GET /inventory/alerts?status=OPEN`, inventory-alerts:READ). */
export function StockAlertsWidget() {
  const canRead = useCan(DASHBOARD_ALERT_PERMISSION);
  const query = useOpenAlerts(canRead);
  if (!canRead) return null;
  const items = query.data?.items ?? [];
  return (
    <section
      aria-label={L.alertsTitle}
      className="border-border-default bg-bg-surface mb-6 rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]"
    >
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="text-warning size-4" />
        <h2 className="text-ink-primary text-[0.875rem] font-semibold">{L.alertsTitle}</h2>
        {query.data && (
          <span className="bg-warning/12 text-warning rounded-full px-2 py-0.5 text-[0.625rem] font-bold tabular-nums">
            {query.data.totalElements}
          </span>
        )}
      </div>
      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError ? (
        <p role="alert" className="text-danger text-sm">
          {L.alertsLoadError}
        </p>
      ) : items.length === 0 ? (
        <EmptyState title={L.alertsEmptyTitle} description={L.alertsEmptyDescription} />
      ) : (
        <>
          <Table>
            <TableCaption className="sr-only">{L.alertsTitle}</TableCaption>
            <TableHeader>
              <TableRow>
                {[L.alertKind, L.alertSku, L.alertWarehouse, L.alertLot, L.alertExpiry].map((h) => (
                  <TableHead key={h} scope="col">
                    {h}
                  </TableHead>
                ))}
                <TableHead scope="col" className="text-right">
                  {L.alertObserved}
                </TableHead>
                <TableHead scope="col" className="text-right">
                  {L.alertThreshold}
                </TableHead>
                <TableHead scope="col">{L.alertOpenedAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>{alertKindLabel(alert.kind)}</TableCell>
                  <TableCell className="font-mono">{alert.sku}</TableCell>
                  <TableCell>{alertWarehouseLabel(alert.warehouseCode)}</TableCell>
                  <TableCell className="font-mono">{alert.lotNumber ?? L.unavailable}</TableCell>
                  <TableCell>{alert.expiryDate ?? L.unavailable}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {alert.observedQty}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {alert.thresholdQty ?? L.unavailable}
                  </TableCell>
                  <TableCell>{formatDateTime(alert.openedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {query.data && query.data.totalElements > items.length && (
            <p className="text-ink-tertiary mt-2 text-xs">{L.alertsMore}</p>
          )}
        </>
      )}
    </section>
  );
}
