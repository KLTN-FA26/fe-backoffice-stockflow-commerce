"use client";

import { AlertTriangle } from "lucide-react";

import { DASHBOARD_ALERT_PERMISSION, DASHBOARD_LABELS } from "@/constants/dashboard";

import { hasPermission, useMyPermissions } from "@/lib/auth";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { KPI_DEFINITIONS } from "../kpis";
import { AlertsKpiTile, KpiTile } from "./KpiTile";

const GRID = "mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6";

/**
 * Row of KPI tiles from the real list endpoints. A tile appears only for a user who holds the BE
 * permission of its endpoint (UI-only gating — Backend phải re-check @RequiresPermission).
 */
export function DashboardKpis() {
  const permissions = useMyPermissions();
  if (permissions.isPending) {
    return (
      <div className={GRID} aria-busy="true">
        {KPI_DEFINITIONS.map((definition) => (
          <Skeleton key={definition.key} className="h-[92px] rounded-[var(--card-radius)]" />
        ))}
      </div>
    );
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
    <div className={GRID}>
      {visible.map((definition) => (
        <KpiTile key={definition.key} definition={definition} />
      ))}
      {showAlerts && <AlertsKpiTile icon={AlertTriangle} />}
    </div>
  );
}
