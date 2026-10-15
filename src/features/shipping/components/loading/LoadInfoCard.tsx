"use client";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { reconcileLoad } from "@/features/shipping/selectors";
import { StatusDot } from "@/components/shared/StatusDot";

import { LoadProgress } from "../LoadProgress";
import { InfoItem } from "../primitives";

import type { Load } from "@/features/shipping/types";

const F = UI_LABELS.shipping.field;
const dt = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");

/** Thông tin chuyến: xe đặt ngoài hệ thống (biển số, loại xe, hãng) + tiến độ quét. */
export function LoadInfoCard({ load }: { load: Load }) {
  const { loaded, planned } = reconcileLoad(load);
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-ink-primary text-[0.9375rem] font-semibold">
          {UI_LABELS.shipping.info.title}
        </h2>
        <StatusDot domain="shipment" status={load.status} size="md" withIcon />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoItem label={F.vehiclePlate} value={load.vehiclePlate ?? "—"} mono />
        <InfoItem label={F.vehicleType} value={load.vehicleType ?? "—"} />
        <InfoItem label={F.carrier} value={load.carrierName ?? "—"} />
        <InfoItem label={F.bookedAt} value={dt(load.bookedAt)} />
      </div>
      <div className="mt-4">
        <div className="text-ink-tertiary mb-1 text-xs">{UI_LABELS.shipping.info.progress}</div>
        {/* Cùng nguồn (`lines`) với bảng đối soát và nút bàn giao */}
        <LoadProgress loaded={loaded} planned={planned} size="md" />
      </div>
    </section>
  );
}
