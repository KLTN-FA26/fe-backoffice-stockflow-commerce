"use client";

import { SearchX } from "lucide-react";

import { CARTON_LIST_LABELS as L } from "@/constants";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

/** Hai loại empty khác nhau (api-conventions §8): chưa có thùng / lọc không ra — giữ header để còn chỉnh lọc. */
export function CartonEmpty({
  filtered,
  onClearFilters,
}: {
  filtered: boolean;
  onClearFilters: () => void;
}) {
  if (!filtered) return <EmptyState title={L.emptyTitle} description={L.emptyDescription} />;
  return (
    <EmptyState
      icon={<SearchX className="size-8" />}
      title={L.filteredTitle}
      description={L.filteredDescription}
      action={
        <Button size="sm" variant="outline" onClick={onClearFilters}>
          {L.clearFilters}
        </Button>
      }
    />
  );
}
