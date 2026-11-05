"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

import type { PlanVehicle } from "@/features/load-planning/plan-types";

const L = UI_LABELS.loadPlan.detail;

/** Chọn xe để xem bố cục; xe bị bỏ kiện (đơn bị huỷ) có huy hiệu "Cần tính lại". */
export function VehicleSwitcher({
  vehicles,
  selectedSeq,
  onSelect,
}: {
  vehicles: readonly PlanVehicle[];
  selectedSeq: number;
  onSelect: (seq: number) => void;
}) {
  return (
    <div role="group" aria-label={L.vehicleSwitcher} className="flex flex-wrap gap-2">
      {vehicles.map((vehicle) => {
        const active = vehicle.seq === selectedSeq;
        return (
          <button
            key={vehicle.seq}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(vehicle.seq)}
            className={cn(
              "border-border-default bg-bg-surface hover:bg-bg-subtle flex items-center gap-2 rounded border px-3 py-1.5 text-[0.8125rem] transition-colors",
              active && "border-brand bg-bg-subtle text-ink-primary font-medium",
            )}
          >
            <span>{L.vehicleTitle(vehicle.seq, vehicle.code)}</span>
            <span className="text-ink-tertiary text-xs tabular-nums">
              {formatPercent(vehicle.volumeFillPct / 100, 0)}
            </span>
            {vehicle.needsRecalculation && (
              <Badge variant="destructive">{L.needsRecalculation}</Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
