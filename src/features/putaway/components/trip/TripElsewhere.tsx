"use client";

import Link from "next/link";

import { ADMIN_ROUTES, PUTAWAY_TRIP_LABELS, WORKSPACE_PATHS } from "@/constants";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

const L = PUTAWAY_TRIP_LABELS.elsewhere;

/**
 * Chuyến thuộc kho khác kho của tab (spec 2026-11-22 §5.8): mỗi NV chỉ một chuyến mở trên mọi kho
 * (`PUTAWAY_TRIP_ALREADY_OPEN`), `GET /putaway-trips/current` không lọc theo kho. Không render chuyến ở đây (màn trong
 * tab chỉ làm việc với kho trên URL) — báo kèm link sang tab của kho đó, không tự chuyển trang.
 */
export function TripElsewhere({
  warehouseId,
  tripId,
  mine,
}: {
  warehouseId: string;
  /** Có id → link sang chính chuyến đó; không → "chuyến của tôi" ở kho đó. */
  tripId?: string;
  mine: boolean;
}) {
  const directory = useWarehouseDirectory();
  const prefix = directory.data?.find((w) => w.warehouseId === warehouseId)?.code;
  if (!prefix) return directory.isPending ? <PageSkeleton variant="detail" /> : null;
  const href = ADMIN_ROUTES.warehouseMap.page(
    prefix,
    tripId ? WORKSPACE_PATHS.trip(tripId) : WORKSPACE_PATHS.myTrip,
  );
  return (
    <EmptyState
      title={mine ? L.mine(prefix) : L.other(prefix)}
      description={L.description}
      action={
        <Button asChild size="sm">
          <Link href={href}>{L.open}</Link>
        </Button>
      }
    />
  );
}
