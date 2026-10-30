"use client";

import { NOTIFICATION_LABELS } from "@/constants/notifications";

import { Button } from "@/components/ui/button";

import type { NotificationPage } from "../types";

interface NotificationPagerProps {
  /** Zero-based, like the BE page index. */
  page: number;
  data: Pick<NotificationPage, "totalPages" | "hasPrevious" | "hasNext">;
  onPageChange: (page: number) => void;
}

/** Previous/next footer of the inbox dropdown; hidden when everything fits on one page. */
export function NotificationPager({ page, data, onPageChange }: NotificationPagerProps) {
  if (data.totalPages <= 1) return null;
  return (
    <div className="border-border-default flex items-center justify-between gap-2 border-t px-3 py-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!data.hasPrevious}
        onClick={() => onPageChange(page - 1)}
      >
        {NOTIFICATION_LABELS.previous}
      </Button>
      <span className="text-ink-tertiary text-xs tabular-nums">
        {NOTIFICATION_LABELS.page(page + 1, data.totalPages)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!data.hasNext}
        onClick={() => onPageChange(page + 1)}
      >
        {NOTIFICATION_LABELS.next}
      </Button>
    </div>
  );
}
