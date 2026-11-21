"use client";

import { MapPinned } from "lucide-react";

import { PUTAWAY_TRIP_ITEM_STATUS, PUTAWAY_TRIP_LABELS } from "@/constants";
import { holdExpired, stopsWithCartons } from "@/features/putaway/trip-selectors";

import { DetailSection } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { PutawayTrip } from "@/features/putaway/types";

const L = PUTAWAY_TRIP_LABELS.route;
const C = PUTAWAY_TRIP_LABELS.cart;
const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

/**
 * Lộ trình của chuyến đang đi (docs 05 §4.5 bước 14): điểm dừng theo thứ tự, mỗi điểm là một bin kèm thùng cần đặt.
 * Thứ tự chỉ để tham khảo (BR-17). `onReassign` vắng = chỉ xem. Đường đi trên bản đồ 2D chưa vẽ ở màn này.
 */
export function TripRouteSection({
  trip,
  onReassign,
  pendingLpn,
}: {
  trip: PutawayTrip;
  onReassign?: (lpn: string) => void;
  pendingLpn?: string | null;
}) {
  const stops = stopsWithCartons(trip);
  // Thùng còn trên xe mà không nằm ở điểm dừng nào (không bin nào nhận, không có OVERFLOW) — vẫn phải thấy để đổi bin
  const routed = new Set(stops.flatMap((stop) => stop.cartons.map((c) => c.lpn.toUpperCase())));
  const unrouted = trip.cartons.filter(
    (c) => c.status === PUTAWAY_TRIP_ITEM_STATUS.ON_CART && !routed.has(c.lpn.toUpperCase()),
  );
  const groups = [
    ...stops.map((stop) => ({ key: `stop-${stop.sequence}`, ...stop })),
    ...(unrouted.length > 0
      ? [{ key: "no-bin", sequence: null, locationCode: L.noBin, cartons: unrouted }]
      : []),
  ];
  return (
    <DetailSection title={L.title} icon={MapPinned}>
      <p className="text-ink-tertiary mb-3 text-xs">{L.note}</p>
      <ol className="border-border-default divide-y divide-(--table-line) rounded-(--section-radius) border">
        {groups.map((stop) => (
          <li key={stop.key} className="flex gap-3 px-3 py-2.5">
            <span
              className={`bg-bg-muted text-ink-secondary flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${MONO}`}
              aria-label={stop.sequence === null ? undefined : L.stop(stop.sequence)}
              aria-hidden={stop.sequence === null || undefined}
            >
              {stop.sequence ?? "–"}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className={`text-ink-primary text-[0.8125rem] font-semibold ${MONO}`}>
                {stop.locationCode}
              </p>
              <ul className="space-y-1">
                {stop.cartons.map((carton) => (
                  <li
                    key={carton.lpn}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`text-ink-secondary text-[0.8125rem] ${MONO}`}>
                        {carton.lpn}
                      </span>
                      <StatusDot domain="move" status={carton.status} size="sm" />
                      {holdExpired(carton) && (
                        <span className="text-warning text-xs">{C.holdExpired}</span>
                      )}
                    </span>
                    {onReassign && carton.status === PUTAWAY_TRIP_ITEM_STATUS.ON_CART && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        aria-label={L.reassign(carton.lpn)}
                        disabled={pendingLpn === carton.lpn}
                        onClick={() => onReassign(carton.lpn)}
                        className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary h-7 rounded-[var(--r-sm)] px-2.5 text-xs"
                      >
                        {L.reassignShort}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </DetailSection>
  );
}
