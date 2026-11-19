"use client";

import { PRODUCTION_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const L = PRODUCTION_LABELS.schedule;

/**
 * Trạng thái rỗng của một mục trên lịch sản xuất — hai loại khác nhau (api-conventions §8): chưa có dữ liệu, hoặc bộ
 * lọc không ra kết quả (kèm "Bỏ bộ lọc").
 */
export function ScheduleEmpty({
  filtered,
  title,
  description,
  onClearFilters,
}: {
  filtered: boolean;
  title: string;
  description: string;
  onClearFilters: () => void;
}) {
  if (!filtered) return <EmptyState className="py-8" title={title} description={description} />;
  return (
    <EmptyState
      className="py-8"
      title={L.filteredTitle}
      description={L.filteredDescription}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
          {L.clearFilters}
        </Button>
      }
    />
  );
}
