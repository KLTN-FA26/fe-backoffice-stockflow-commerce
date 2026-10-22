"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { formatFixed, formatPercent } from "@/lib/format";

import { vehicleStats } from "../../editor/selectors";

import type { EditVehicle } from "../../editor/types";

const L = UI_LABELS.loadPlan.detail;
const E = UI_LABELS.loadPlan.editor;

/** Chọn xe đang chỉnh; số kiện và tỉ lệ lấp đầy tính theo bản ĐANG SOẠN (không phải bản đã lưu). */
export function EditorVehicleTabs({
  vehicles,
  selectedSeq,
  flaggedSeqs,
  onSelect,
}: {
  vehicles: readonly EditVehicle[];
  selectedSeq: number;
  /** Xe có kiện vi phạm — chấm đỏ để không phải mở từng xe tìm lỗi. */
  flaggedSeqs: ReadonlySet<number>;
  onSelect: (seq: number) => void;
}) {
  return (
    <div role="group" aria-label={L.vehicleSwitcher} className="flex flex-wrap gap-2">
      {vehicles.map((vehicle) => {
        const stats = vehicleStats(vehicle);
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
              {E.vehicle.boxes(stats.count)} · {formatPercent(stats.volumePct, 0)} ·{" "}
              {formatFixed(stats.weightKg, 1)} kg
            </span>
            {flaggedSeqs.has(vehicle.seq) && (
              <span aria-label={E.tray.flagged} className="bg-danger size-2 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
