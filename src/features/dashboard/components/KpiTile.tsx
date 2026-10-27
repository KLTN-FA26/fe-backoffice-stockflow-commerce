"use client";

import { DASHBOARD_LABELS } from "@/constants/dashboard";

import { StatCell } from "@/components/shared/StatStrip";

import { useAlertSummary, useKpiCount } from "../queries";
import { alertBreakdown, totalOpenAlerts } from "../selectors";

import type { LucideIcon } from "lucide-react";
import type { KpiDefinition } from "../kpis";

interface TileView {
  value: string | number;
  title?: string;
}

// A failed or still-loading number is never replaced by a guess.
function view(
  query: { isPending: boolean; isError: boolean },
  value: string | number | undefined,
): TileView {
  if (query.isError) {
    return { value: DASHBOARD_LABELS.unavailable, title: DASHBOARD_LABELS.unavailableHint };
  }
  return { value: query.isPending || value === undefined ? DASHBOARD_LABELS.loading : value };
}

export function KpiTile({ definition }: { definition: KpiDefinition }) {
  const query = useKpiCount(definition.source, true);
  const state = view(query, query.data);
  return (
    <StatCell
      label={definition.label}
      icon={definition.icon}
      tone={definition.tone}
      href={definition.href}
      value={state.value}
      title={state.title}
    />
  );
}

export function AlertsKpiTile({ icon }: { icon: LucideIcon }) {
  const query = useAlertSummary(true);
  const state = view(query, query.data ? totalOpenAlerts(query.data) : undefined);
  // Chi tiết theo loại cảnh báo chỉ hiện khi rê chuột — ô giữ một dòng số cho gọn.
  const breakdown = query.data ? alertBreakdown(query.data) : "";
  return (
    <StatCell
      label={DASHBOARD_LABELS.alertsOpen}
      icon={icon}
      tone="danger"
      value={state.value}
      title={state.title ?? (breakdown || undefined)}
    />
  );
}
