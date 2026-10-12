"use client";

import { CalendarClock } from "lucide-react";

import { LOAD_COLUMNS, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { buildLoadColumns } from "./list/columns";
import { COLUMN_LABELS, DEFAULT_COLUMNS, STATUS_OPTIONS } from "./list/constants";
import { LoadListBody } from "./list/LoadListBody";
import { buildLoadSummary } from "./list/summary";
import { useLoadListState } from "./list/useLoadListState";
import { ShippingPermissionGate } from "./ShippingPermissionGate";

const L = UI_LABELS.shipping;
const COLUMN_OPTIONS = DEFAULT_COLUMNS.filter((c) => c !== LOAD_COLUMNS.ACTIONS).map((c) => ({
  label: COLUMN_LABELS[c] ?? c,
  value: c,
}));

/** Lập kế hoạch xếp xe (3D, chọn + đặt xe) thuộc SCRUM-452 — ở đây chỉ để nút khoá. */
function PlanLoadButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Button size="sm" disabled className="rounded-[var(--r-sm)]">
            <CalendarClock className="size-3.5" /> {L.action.planLoad}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{L.loadPlanInProgress}</TooltipContent>
    </Tooltip>
  );
}

function LoadListContent() {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const s = useLoadListState(canRead);
  const columns = buildLoadColumns(s.navigateToLoading);
  const visibleColumns = columns.filter((c) => s.config.visibleColumns.includes(c.key));
  const { filters } = s;

  return (
    <>
      <PageHeader title={L.pageTitle} subtitle={L.subtitle} actions={<PlanLoadButton />} />
      {canRead && (
        <ListToolbar
          search={filters.q}
          onSearchChange={(v) => void filters.setQ(v)}
          searchPlaceholder={L.searchPlaceholder}
          statusOptions={STATUS_OPTIONS}
          selectedStatuses={filters.status}
          onToggleStatus={s.toggleStatus}
          onClearStatuses={() => void filters.setStatus([])}
          hasStatusFilter={filters.status.length > 0}
          columnOptions={COLUMN_OPTIONS}
          selectedColumns={s.config.visibleColumns}
          defaultColumns={DEFAULT_COLUMNS}
          lockedColumns={[LOAD_COLUMNS.ACTIONS]}
          visibleColumnCount={s.visibleColumnCount}
          onToggleColumn={s.toggleColumn}
          onResetColumns={() => s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS }))}
          hasColumnConfig={s.hasColumnConfig}
          summaryItems={buildLoadSummary(s)}
          onResetAll={s.resetAll}
          resetDisabled={!s.hasFilters && !s.hasColumnConfig}
        />
      )}
      <LoadListBody s={s} columns={visibleColumns} />
      <p className="text-ink-tertiary mt-3 text-xs">{L.noTracking}</p>
    </>
  );
}

export function LoadList() {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]} variant="list">
      <LoadListContent />
    </ShippingPermissionGate>
  );
}
