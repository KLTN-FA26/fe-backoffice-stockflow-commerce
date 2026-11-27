"use client";

import { SearchX } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

/**
 * "Lọc không ra" (api-conventions §8 — khác "chưa có dữ liệu"): nằm trong thân bảng để header + nút lọc cột vẫn hiện,
 * kèm nút "Bỏ bộ lọc".
 */
export function FilteredEmpty({
  description,
  onClear,
}: {
  description: string;
  onClear: () => void;
}) {
  return (
    <EmptyState
      className="rounded-none border-0 bg-transparent py-10 whitespace-normal"
      icon={<SearchX className="size-8" />}
      title={UI_LABELS.emptyList.noResultsTitle}
      description={description}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          {UI_LABELS.emptyList.clearFilters}
        </Button>
      }
    />
  );
}
