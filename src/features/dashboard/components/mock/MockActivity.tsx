/**
 * MOCK ONLY — rendered solely when `useIsMock()` is true (see `MockDashboardPanels`). The data of
 * this widget exists only in the demo dataset; the backend has no endpoint for it.
 */
"use client";

import { useMemo } from "react";
import { cn } from "cn";
import { Clock } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { shipments } from "@/lib/mock-data";

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  type: "info" | "warning" | "success";
}

function collectActivities(): ActivityItem[] {
  const activities: ActivityItem[] = [];

  // Recent shipment events
  for (const sh of shipments) {
    for (const ev of sh.trackingEvents) {
      let type: ActivityItem["type"] = "info";
      if (["Delivery Failed", "Exception", "Returning"].includes(ev.status)) {
        type = "warning";
      } else if (ev.status === "Delivered") {
        type = "success";
      }
      activities.push({
        id: ev.eventId,
        description: `${sh.shipmentNumber}: ${ev.status}${ev.note ? ` — ${ev.note}` : ""} (${ev.location})`,
        timestamp: ev.timestamp,
        type,
      });
    }
  }

  // Sort by timestamp desc, take 8
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return activities.slice(0, 8);
}

export function MockActivity() {
  const activities = useMemo(() => collectActivities(), []);
  return (
    <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="text-info size-4" />
        <h2 className="text-ink-primary text-[0.875rem] font-semibold">Hoạt động gần đây</h2>
      </div>
      {activities.length > 0 ? (
        <div className="relative pl-6">
          {/* Vertical line: left 6px, w 2px → center 7px */}
          <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
          {activities.map((act) => (
            <div key={act.id} className="relative pb-4 last:pb-0">
              {/* Dot: 11px, center must be 7px from container → left from child = -(24-1.5) = -22.5px */}
              <div
                className={cn(
                  "border-bg-surface absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2",
                  act.type === "warning" && "bg-warning",
                  act.type === "success" && "bg-positive",
                  act.type === "info" && "bg-info",
                )}
              />
              <div className="text-ink-primary text-[0.8125rem] leading-snug">
                {act.description}
              </div>
              <div className="text-ink-tertiary mt-0.5 text-xs tabular-nums">
                {new Date(act.timestamp).toLocaleString("vi-VN")}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Chưa có hoạt động"
          description="Các sự kiện vận đơn sẽ hiển thị ở đây."
        />
      )}
    </div>
  );
}
