"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";

import { ADMIN_ROUTES, WAREHOUSE_LOCATION_LABELS as L } from "@/constants";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

/**
 * Hai loại empty khác nhau (api-conventions §8): kho chưa có vị trí → mở bản đồ để tạo; lọc không ra → bỏ bộ lọc.
 * Truyền qua `DataTable emptyState` để header vẫn còn nút lọc.
 */
export function LocationEmpty({
  noLocations,
  prefix,
  onClearFilters,
}: {
  noLocations: boolean;
  prefix: string;
  onClearFilters: () => void;
}) {
  if (noLocations)
    return (
      <EmptyState
        title={L.emptyTitle}
        description={L.emptyDescription}
        action={
          <Button asChild size="sm">
            <Link href={ADMIN_ROUTES.warehouseMap.of(prefix)}>{L.openMap}</Link>
          </Button>
        }
      />
    );
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
