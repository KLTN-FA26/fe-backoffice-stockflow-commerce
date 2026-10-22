"use client";

import { UI_LABELS, VEHICLE_TYPE_STATUS_LABELS, VEHICLE_TYPE_STATUSES } from "@/constants";
import { SearchBar } from "@/components/shared/SearchBar";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { VehicleTypeListState } from "./useVehicleTypeListState";

const L = UI_LABELS.vehicleType;

/** Lọc theo mã / tên và trạng thái (BE `search`, `status`). */
export function VehicleTypeFilters({ s }: { s: VehicleTypeListState }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <SearchBar
        value={s.q}
        onChange={s.setQ}
        placeholder={L.searchPlaceholder}
        aria-label={L.searchPlaceholder}
        className="max-w-xs"
      />
      <div className="flex items-center gap-2">
        <Label htmlFor="vehicle-type-status" className="text-ink-secondary text-[0.8125rem]">
          {L.statusFilter}
        </Label>
        <Select value={s.status} onValueChange={s.setStatus}>
          <SelectTrigger
            id="vehicle-type-status"
            className="border-border-default bg-bg-surface h-8 w-[12rem] rounded-[var(--r-sm)] text-[0.8125rem]"
          >
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title={L.statusFilter}>
            <SelectItem value="ALL">{L.all}</SelectItem>
            {VEHICLE_TYPE_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {VEHICLE_TYPE_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      </div>
      {s.hasFilters && (
        <Button type="button" variant="ghost" size="xs" onClick={s.clearFilters}>
          {L.clearFilters}
        </Button>
      )}
    </div>
  );
}
