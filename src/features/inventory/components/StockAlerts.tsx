"use client";

import { AlertTriangle, CalendarClock } from "lucide-react";
import { useState } from "react";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { PAGE_SIZE } from "@/constants/table";

import { formatDate } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";

import { Skeleton } from "@/components/shared/Skeleton";
import { Badge } from "@/components/ui/badge";

import { useStockAlerts } from "../queries";
import { alertKindLabel, alertStatusLabel } from "../selectors";
import { InventoryError } from "./InventoryFeedback";
import { InventoryPager } from "./InventoryPager";

import type { StockAlert, StockAlertListParams } from "../types";

// Alerts still in force: an acknowledged alert is seen, not cleared (StockAlertResponse.status).
const LIVE = ["OPEN", "ACKNOWLEDGED"] as const;
const { missing } = INVENTORY_LABELS;

/**
 * SKU-wide low stock (REORDER / SAFETY): the backend compares usable on-hand across the whole
 * system with the SKU's thresholds. No warehouse is named, so no warehouse row is marked.
 */
export function LowStockAlerts({ sku }: { sku: string }) {
  return (
    <AlertList
      id="inventory-low-stock"
      title={INVENTORY_LABELS.lowStockTitle}
      empty={INVENTORY_LABELS.noLowStockAlerts}
      filter={{ kind: ["REORDER", "SAFETY"], status: [...LIVE], sku }}
      icon={AlertTriangle}
      detail={(alert) =>
        `${INVENTORY_LABELS.observedQty}: ${formatNumber(alert.observedQty)} · ${
          INVENTORY_LABELS.thresholdQty
        }: ${alert.thresholdQty === null || alert.thresholdQty === undefined ? missing : formatNumber(alert.thresholdQty)}`
      }
    />
  );
}

/** Lot expiry in one warehouse (EXPIRING / EXPIRED), with the backend's own days-to-expiry. */
export function ExpiryAlerts({ sku, warehouseId }: { sku: string; warehouseId: string }) {
  return (
    <AlertList
      id="inventory-expiry-alerts"
      title={INVENTORY_LABELS.expiryAlertsTitle}
      empty={INVENTORY_LABELS.noExpiryAlerts}
      filter={{ kind: ["EXPIRING", "EXPIRED"], status: [...LIVE], sku, warehouseId }}
      icon={CalendarClock}
      detail={(alert) =>
        [
          `${INVENTORY_LABELS.lot}: ${alert.lotNumber ?? missing}`,
          `${INVENTORY_LABELS.expiryDate}: ${alert.expiryDate ? formatDate(alert.expiryDate) : missing}`,
          `${INVENTORY_LABELS.daysToExpiry}: ${alert.daysToExpiry ?? missing}`,
          `${INVENTORY_LABELS.observedQty}: ${formatNumber(alert.observedQty)}`,
        ].join(" · ")
      }
    />
  );
}

function AlertList({
  id,
  title,
  empty,
  filter,
  icon: Icon,
  detail,
}: {
  id: string;
  title: string;
  empty: string;
  filter: Omit<StockAlertListParams, "page" | "size">;
  icon: typeof AlertTriangle;
  detail: (alert: StockAlert) => string;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(PAGE_SIZE.md);
  const query = useStockAlerts({ ...filter, page: page - 1, size });

  return (
    <section aria-labelledby={id} aria-busy={query.isFetching} className="space-y-2">
      <h3 id={id} className="text-ink-secondary text-xs font-semibold">
        {title}
      </h3>
      {query.isLoading ? (
        <Skeleton className="h-6 w-64" />
      ) : query.isError ? (
        <InventoryError error={query.error} retry={() => void query.refetch()} />
      ) : !query.data ? null : query.data.totalElements === 0 ? (
        // totalElements counts the whole filtered set, not this page: absence is the server's answer.
        <p className="text-ink-tertiary text-sm">{empty}</p>
      ) : (
        <>
          <ul className="space-y-1">
            {query.data.items.map((alert) => (
              <li key={alert.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                  variant="outline"
                  className={
                    alert.kind === "EXPIRED" || alert.kind === "SAFETY"
                      ? "border-danger/30 bg-danger/10 text-danger"
                      : "border-warning/30 bg-warning/10 text-warning"
                  }
                >
                  <Icon aria-hidden="true" />
                  {alertKindLabel(alert.kind)}
                </Badge>
                <span className="text-ink-tertiary text-xs">{alertStatusLabel(alert.status)}</span>
                <span className="text-ink-secondary tabular-nums">{detail(alert)}</span>
                {alert.reservationImpaired && (
                  <Badge variant="outline">{INVENTORY_LABELS.reservationImpaired}</Badge>
                )}
              </li>
            ))}
          </ul>
          {query.data.totalPages > 1 && (
            <InventoryPager
              id={`${id}-page-size`}
              data={query.data}
              pending={query.isFetching}
              size={size}
              setSize={(next) => {
                setSize(next);
                setPage(1);
              }}
              setPage={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}
