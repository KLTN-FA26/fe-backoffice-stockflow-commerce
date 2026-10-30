import { NOTIFICATION_LABELS } from "@/constants/notifications";

import { formatDateTime } from "@/lib/format/date";

import { Badge } from "@/components/ui/badge";

import type { Notification } from "../types";

const SEVERITY_STYLE: Record<Notification["severity"], string> = {
  INFO: "border-info/30 bg-info/10 text-info",
  WARN: "border-warning/30 bg-warning/10 text-warning",
  CRITICAL: "border-danger/30 bg-danger/10 text-danger",
};

export function NotificationItems({
  items,
  onSelect,
}: {
  items: Notification[];
  onSelect: (item: Notification) => void;
}) {
  return (
    <ul aria-label={NOTIFICATION_LABELS.title} className="divide-border-default divide-y">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className={`hover:bg-bg-muted focus-visible:ring-border-strong flex w-full flex-col gap-1 px-3 py-3 text-left text-sm focus-visible:ring-2 focus-visible:outline-none ${item.read ? "" : "bg-info/5"}`}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <Badge variant="outline" className={SEVERITY_STYLE[item.severity]}>
                {NOTIFICATION_LABELS.severity[item.severity]}
              </Badge>
              <span className="text-ink-tertiary text-xs tabular-nums">
                {formatDateTime(item.createdAt)}
              </span>
            </span>
            <span className="text-ink-primary flex items-center gap-2 font-medium">
              {!item.read && (
                <span aria-hidden className="bg-info size-1.5 shrink-0 rounded-full" />
              )}
              {item.title}
            </span>
            {item.body && (
              <span className="text-ink-secondary line-clamp-2 text-xs">{item.body}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
