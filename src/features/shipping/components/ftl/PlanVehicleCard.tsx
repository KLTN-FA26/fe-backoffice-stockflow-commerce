import { UI_LABELS } from "@/constants";

import { InfoItem, MONO } from "../primitives";

import type { Load } from "@/features/shipping/types";

const F = UI_LABELS.shipping.ftl;

/**
 * Xe của kế hoạch xếp xe mà chuyến nguyên xe thuộc về: mã kế hoạch, số xe, loại xe. Kiện trên chuyến do
 * kế hoạch xếp nên lô không thêm / bớt tay (BE 409 LOAD_MANAGED_BY_PLAN). Mã kế hoạch hiện dạng chữ — màn chi
 * tiết kế hoạch thuộc PR F4.
 */
export function PlanVehicleCard({ load }: { load: Load }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-1 text-[0.9375rem] font-semibold">{F.planCard}</h2>
      <p className="text-ink-secondary mb-3 text-[0.8125rem]">{F.planCardHint}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoItem label={F.planCode} value={load.loadPlanCode ?? "—"} mono />
        <InfoItem
          label={F.vehicleSeq}
          value={load.vehicleSeq != null ? <span className={MONO}>{load.vehicleSeq}</span> : "—"}
        />
        <InfoItem label={F.vehicleType} value={load.vehicleTypeCode ?? "—"} mono />
      </div>
    </section>
  );
}
