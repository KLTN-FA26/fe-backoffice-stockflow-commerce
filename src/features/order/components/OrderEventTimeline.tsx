import type { OrderEvent } from "../types";

interface OrderEventTimelineProps {
  events: readonly OrderEvent[];
}

export function OrderEventTimeline({ events }: OrderEventTimelineProps) {
  if (events.length === 0) return null;

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Lịch sử sự kiện</h2>
      <div className="relative pl-6">
        <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
        {events.map((ev, i) => (
          <div key={ev.eventId} className="relative pb-4 last:pb-0">
            <div
              className={
                i === events.length - 1
                  ? "bg-info absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2 border-[var(--bg-surface)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--info)_18%,transparent)]"
                  : "bg-border-strong absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2 border-[var(--bg-surface)]"
              }
            />
            <div className="text-ink-primary text-[0.875rem] font-semibold">{ev.description}</div>
            <div className="text-ink-tertiary text-xs tabular-nums">
              {new Date(ev.createdAt).toLocaleString("vi-VN")} · {ev.actor}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
