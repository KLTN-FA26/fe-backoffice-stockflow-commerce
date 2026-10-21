"use client";

import Link from "next/link";

import { DASHBOARD_LABELS } from "@/constants/dashboard";

import { StatTile } from "@/components/shared/StatTile";

import { useAlertSummary, useKpiCount } from "../queries";
import { alertBreakdown, totalOpenAlerts } from "../selectors";

import type { LucideIcon } from "lucide-react";
import type { KpiDefinition } from "../kpis";

const LINK_CLASS =
  "focus-visible:ring-brand block rounded-[var(--card-radius)] focus-visible:ring-2 focus-visible:outline-none";

interface TileView {
  value: string | number;
  subtitle?: string;
}

// A failed or still-loading number is never replaced by a guess.
function view(query: { isPending: boolean; isError: boolean }, value: string | number | undefined) {
  if (query.isError) {
    return { value: DASHBOARD_LABELS.unavailable, subtitle: DASHBOARD_LABELS.unavailableHint };
  }
  return { value: query.isPending || value === undefined ? DASHBOARD_LABELS.loading : value };
}

function Tile({
  label,
  icon,
  href,
  state,
}: {
  label: string;
  icon: LucideIcon;
  href?: string;
  state: TileView;
}) {
  const tile = <StatTile label={label} icon={icon} value={state.value} subtitle={state.subtitle} />;
  return href ? (
    <Link href={href} className={LINK_CLASS}>
      {tile}
    </Link>
  ) : (
    tile
  );
}

export function KpiTile({ definition }: { definition: KpiDefinition }) {
  const query = useKpiCount(definition.source, true);
  return (
    <Tile
      label={definition.label}
      icon={definition.icon}
      href={definition.href}
      state={view(query, query.data)}
    />
  );
}

export function AlertsKpiTile({ icon }: { icon: LucideIcon }) {
  const query = useAlertSummary(true);
  const state = view(query, query.data ? totalOpenAlerts(query.data) : undefined);
  const breakdown = query.data ? alertBreakdown(query.data) : "";
  return (
    <Tile
      label={DASHBOARD_LABELS.alertsOpen}
      icon={icon}
      state={breakdown ? { ...state, subtitle: breakdown } : state}
    />
  );
}
