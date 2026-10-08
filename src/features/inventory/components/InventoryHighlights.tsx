import { Badge } from "@/components/ui/badge";

import type { InventoryHighlight } from "../types";

const severityClasses = {
  warning: "border-warning/30 bg-warning/10 text-warning",
  critical: "border-danger/30 bg-danger/10 text-danger",
} as const;

export function InventoryHighlights({ highlights }: { highlights: (InventoryHighlight | null)[] }) {
  const active = highlights.filter(
    (highlight): highlight is InventoryHighlight => highlight !== null,
  );
  if (active.length === 0) return <span className="text-ink-tertiary">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {active.map((highlight) => (
        <Badge
          key={`${highlight.severity}:${highlight.label}`}
          variant="outline"
          className={severityClasses[highlight.severity]}
        >
          {highlight.label}
        </Badge>
      ))}
    </div>
  );
}
