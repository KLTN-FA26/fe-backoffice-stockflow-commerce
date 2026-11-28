"use client";

import Link from "next/link";

import { ADMIN_ROUTES, PUTAWAY_TRIP_LABELS, UI_LABELS, WORKSPACE_PATHS } from "@/constants";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

const L = PUTAWAY_TRIP_LABELS.elsewhere;

/**
 * Chuyến thuộc kho khác kho của tab (spec 2026-11-22 §5.8): mỗi NV chỉ một chuyến mở trên mọi kho
 * (`PUTAWAY_TRIP_ALREADY_OPEN`), `GET /putaway-trips/current` không lọc theo kho. Không render chuyến ở đây (màn trong
 * tab chỉ làm việc với kho trên URL) — báo kèm link sang tab của kho đó, không tự chuyển trang. Danh mục kho lỗi → báo
 * lỗi kèm Thử lại; danh mục không có kho của chuyến → vẫn báo, dẫn về bước chọn kho (không để màn trống).
 * Issue #286: chuyến kèm `warehouseCode` (prefix) → dựng link thẳng, không tải danh mục kho; chỉ BE cũ thiếu mã mới tra.
 */
export function TripElsewhere({
  warehouseId,
  warehouseCode,
  tripId,
  mine,
}: {
  warehouseId: string;
  /** Prefix kho BE kèm chuyến (issue #286). */
  warehouseCode?: string | null;
  /** Có id → link sang chính chuyến đó; không → "chuyến của tôi" ở kho đó. */
  tripId?: string;
  mine: boolean;
}) {
  const directory = useWarehouseDirectory(!warehouseCode);
  if (!warehouseCode && directory.isPending) return <PageSkeleton variant="detail" />;
  if (!warehouseCode && directory.isError)
    return (
      <LoadErrorState
        error={directory.error}
        copy={PUTAWAY_TRIP_LABELS.errorCopy}
        onRetry={() => void directory.refetch()}
      />
    );
  const prefix = warehouseCode || directory.data?.find((w) => w.warehouseId === warehouseId)?.code;
  const title = prefix
    ? mine
      ? L.mine(prefix)
      : L.other(prefix)
    : mine
      ? L.mineUnknown
      : L.otherUnknown;
  const href = prefix
    ? ADMIN_ROUTES.warehouseMap.page(
        prefix,
        tripId ? WORKSPACE_PATHS.trip(tripId) : WORKSPACE_PATHS.myTrip,
      )
    : ADMIN_ROUTES.warehouseMap.root;
  return (
    <EmptyState
      title={title}
      description={L.description}
      action={
        <Button asChild size="sm">
          <Link href={href}>
            {prefix ? L.open : UI_LABELS.warehouseMap.workspace.backToChooser}
          </Link>
        </Button>
      }
    />
  );
}
