"use client";

import { PUTAWAY_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const E = PUTAWAY_LABELS.empty;

/**
 * Hai trạng thái rỗng khác nhau (api-conventions §8): kho không còn thùng chờ cất, bộ lọc không ra kết quả (kèm
 * "Bỏ bộ lọc" — gồm cả lọc theo phiếu nhập). Đặt trong `DataTable emptyState` để header — và nút lọc trên cột — vẫn hiện.
 */
export function PutawayEmpty({
  kind,
  onClearFilters,
}: {
  kind: "none" | "noMatch";
  onClearFilters: () => void;
}) {
  if (kind !== "noMatch") {
    return <EmptyState className="py-10" title={E[kind].title} description={E[kind].description} />;
  }
  return (
    <EmptyState
      className="py-10"
      title={E.noMatch.title}
      description={E.noMatch.description}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
          {E.noMatch.clear}
        </Button>
      }
    />
  );
}
