import { INVENTORY_LABELS } from "@/constants/inventory";

/**
 * Stands in for a stock quantity the backend withheld because the slot is under an open cycle
 * count and the caller lacks inventory-cycle-counts:APPROVE (SCRUM-146, BE #202). Never a number.
 */
export function HiddenDuringCountBadge() {
  return (
    <span
      className="border-border-default bg-bg-subtle text-ink-secondary inline-flex items-center rounded-[var(--r-sm)] border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      title={INVENTORY_LABELS.hiddenDuringCountHint}
      data-testid="hidden-during-count"
    >
      {INVENTORY_LABELS.hiddenDuringCount}
    </span>
  );
}
