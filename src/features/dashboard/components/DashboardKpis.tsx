"use client";

import { AlertTriangle } from "lucide-react";

import { DASHBOARD_ALERT_PERMISSION, DASHBOARD_LABELS } from "@/constants/dashboard";

import { hasPermission, useMyPermissions } from "@/lib/auth";

import { Alert } from "@/components/shared/Alert";
import { StatStrip } from "@/components/shared/StatStrip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { KPI_DEFINITIONS } from "../kpis";
import { AlertsKpiTile, KpiTile } from "./KpiTile";

// Một dải gọn: 6 ô một hàng từ xl (laptop 1280), hẹp hơn thì 3 × 2.
const GRID = "mb-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-6";

/**
 * Row of KPI tiles from the real list endpoints. A tile appears only for a user who holds the BE
 * permission of its endpoint (UI-only gating — Backend phải re-check @RequiresPermission).
 */
export function DashboardKpis() {
  const permissions = useMyPermissions();
  if (permissions.isPending) {
    return <Skeleton className="mb-6 h-[66px] rounded-[var(--card-radius)]" aria-busy="true" />;
  }
  if (permissions.isError) {
    return (
      <div className="mb-6" role="alert">
        <Alert tone="warning">
          {DASHBOARD_LABELS.permissionsError}{" "}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => void permissions.refetch()}
          >
            {DASHBOARD_LABELS.retry}
          </Button>
        </Alert>
      </div>
    );
  }
  const visible = KPI_DEFINITIONS.filter((definition) =>
    hasPermission(permissions.data, definition.permission),
  );
  const showAlerts = hasPermission(permissions.data, DASHBOARD_ALERT_PERMISSION);
  if (visible.length === 0 && !showAlerts) return null;
  return (
    <StatStrip className={GRID}>
      {visible.map((definition) => (
        <KpiTile key={definition.key} definition={definition} />
      ))}
      {showAlerts && <AlertsKpiTile icon={AlertTriangle} />}
    </StatStrip>
  );
}
