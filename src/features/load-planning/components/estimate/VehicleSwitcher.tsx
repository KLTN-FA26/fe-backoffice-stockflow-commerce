import { cn } from "cn";

import { LOAD_ESTIMATE_LABELS } from "@/constants";

import type { Layout } from "../../types";

/** Chuyển xem từng xe của ước tính (chỉ hiện khi có từ hai xe). Nút bật/tắt `aria-pressed`, dùng được bằng bàn phím. */
export function VehicleSwitcher({
  vehicles,
  selectedSeq,
  onSelect,
}: {
  vehicles: readonly Pick<Layout, "seq" | "code">[];
  selectedSeq: number;
  onSelect: (seq: number) => void;
}) {
  const L = LOAD_ESTIMATE_LABELS.result;
  if (vehicles.length < 2) return null;
  return (
    <div role="group" aria-label={L.vehicleSwitcher} className="flex flex-wrap gap-1.5">
      {vehicles.map((vehicle) => (
        <button
          key={vehicle.seq}
          type="button"
          aria-pressed={vehicle.seq === selectedSeq}
          onClick={() => onSelect(vehicle.seq)}
          className={cn(
            "rounded-[var(--r-sm)] border px-2.5 py-1 text-xs",
            vehicle.seq === selectedSeq
              ? "border-ink-primary bg-ink-primary text-ink-inverse"
              : "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted",
          )}
        >
          {L.vehicleTab(vehicle.seq, vehicle.code)}
        </button>
      ))}
    </div>
  );
}
