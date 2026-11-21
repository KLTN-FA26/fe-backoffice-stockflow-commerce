"use client";

import { Route } from "lucide-react";

import { PUTAWAY_TRIP_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format";
import { tripProgress } from "@/features/putaway/trip-selectors";

import { DetailSection } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";

import type { ReactNode } from "react";
import type { PutawayTrip } from "@/features/putaway/types";

const L = PUTAWAY_TRIP_LABELS;
const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

function Item({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd
        className={`text-ink-primary mt-0.5 truncate text-[0.8125rem] font-medium ${mono ? MONO : ""}`}
      >
        {children}
      </dd>
    </div>
  );
}

/** "Thông tin chuyến" — trạng thái (domain `move`), tiến độ, mốc thời gian. Cùng lưới 2 / 4 cột với màn cất thùng. */
export function TripInfoSection({ trip }: { trip: PutawayTrip }) {
  const progress = tripProgress(trip);
  return (
    <DetailSection title={L.general} icon={Route}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 xl:grid-cols-4">
        <Item label={L.status}>
          <StatusDot domain="move" status={trip.status} size="sm" />
        </Item>
        <Item label={L.cartonCount} mono>
          {progress.total}
        </Item>
        <Item label={L.progress} mono>
          {L.progressValue(progress.placed, progress.total)}
        </Item>
        <Item label={L.startFrom} mono>
          {trip.startLocationCode ?? "—"}
        </Item>
        <Item label={L.startedAt} mono>
          {trip.startedAt ? formatDateTime(trip.startedAt) : L.notStarted}
        </Item>
        <Item label={L.lastActivity} mono>
          {formatDateTime(trip.lastActivityAt)}
        </Item>
      </dl>
    </DetailSection>
  );
}
