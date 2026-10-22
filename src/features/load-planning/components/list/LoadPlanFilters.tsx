"use client";

import { LOAD_PLAN_STATUS_LABELS, LOAD_PLAN_STATUSES, UI_LABELS } from "@/constants";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { Label } from "@/components/ui/label";

import { WarehouseSelect } from "../WarehouseSelect";

import type { ReactNode } from "react";
import type { LoadPlanListState } from "./useLoadPlanListState";

const L = UI_LABELS.loadPlan;
type Status = (typeof LOAD_PLAN_STATUSES)[number];
const STATUS_OPTIONS = LOAD_PLAN_STATUSES.map((value) => ({
  value,
  label: LOAD_PLAN_STATUS_LABELS[value],
}));

/**
 * Toolbar data-table Mode A: tìm theo mã kế hoạch, lọc trạng thái (BE nhận MỘT trạng thái nên là chọn một) và kho,
 * thanh cấu hình. `actions` = nút lập kế hoạch (góc phải, cùng cỡ `TOOLBAR_ACTION_CLASS`).
 */
export function LoadPlanFilters({ s, actions }: { s: LoadPlanListState; actions?: ReactNode }) {
  const status: Status | null = s.status === "ALL" ? null : s.status;
  return (
    <ListToolbar<Status, string, string>
      search={s.q}
      onSearchChange={s.setQ}
      searchPlaceholder={L.searchPlaceholder}
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={status ? [status] : []}
      onToggleStatus={(value) => s.setStatus(status === value ? "ALL" : value)}
      onClearStatuses={() => s.setStatus("ALL")}
      hasStatusFilter={status !== null}
      facets={
        <div className="flex items-center gap-2">
          <Label htmlFor="load-plan-warehouse" className="text-ink-secondary text-[0.8125rem]">
            {L.warehouseFilter}
          </Label>
          <div className="w-[14rem]">
            <WarehouseSelect
              id="load-plan-warehouse"
              value={s.warehouseId}
              onChange={s.setWarehouseId}
              allLabel={L.all}
            />
          </div>
        </div>
      }
      summaryItems={[
        {
          label: L.summarySearch,
          value: s.q || UI_LABELS.common.notEntered,
          active: s.q !== "",
          onClear: () => s.setQ(""),
        },
        {
          label: L.statusFilter,
          value: status ? LOAD_PLAN_STATUS_LABELS[status] : L.all,
          active: status !== null,
          onClear: () => s.setStatus("ALL"),
        },
      ]}
      actions={actions}
      onResetAll={s.clearFilters}
      resetDisabled={!s.hasFilters}
    />
  );
}
