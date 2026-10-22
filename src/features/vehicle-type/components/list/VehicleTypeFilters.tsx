"use client";

import { UI_LABELS, VEHICLE_TYPE_STATUS_LABELS, VEHICLE_TYPE_STATUSES } from "@/constants";
import { ListToolbar } from "@/components/shared/ListToolbar";

import type { ReactNode } from "react";
import type { VehicleTypeListState } from "./useVehicleTypeListState";

const L = UI_LABELS.vehicleType;
type Status = (typeof VEHICLE_TYPE_STATUSES)[number];
const STATUS_OPTIONS = VEHICLE_TYPE_STATUSES.map((value) => ({
  value,
  label: VEHICLE_TYPE_STATUS_LABELS[value],
}));

/**
 * Toolbar data-table Mode A: tìm theo mã / tên, lọc trạng thái (BE nhận MỘT trạng thái nên là chọn
 * một), thanh cấu hình. `actions` = nút tạo mới (góc phải, cùng cỡ `TOOLBAR_ACTION_CLASS`).
 */
export function VehicleTypeFilters({
  s,
  actions,
}: {
  s: VehicleTypeListState;
  actions?: ReactNode;
}) {
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
      summaryItems={[
        {
          label: "Search chính",
          value: s.q || UI_LABELS.common.notEntered,
          active: s.q !== "",
          onClear: () => s.setQ(""),
        },
        {
          label: L.statusFilter,
          value: status ? VEHICLE_TYPE_STATUS_LABELS[status] : L.all,
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
