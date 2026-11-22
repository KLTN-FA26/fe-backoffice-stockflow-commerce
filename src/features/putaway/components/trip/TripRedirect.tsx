"use client";

import { PUTAWAY_TRIP_LABELS, WORKSPACE_PATHS } from "@/constants";
import { WorkspaceRedirect } from "@/lib/workspace";
import { useCurrentTrip, useTrip } from "@/features/putaway/trip-queries";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Link cũ `/admin/putaway/trips/{id}` → chuyến trong tab theo kho của chuyến (spec 2026-11-22 §5.5). */
export function TripRedirect({ tripId }: { tripId: string }) {
  const query = useTrip(tripId);
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={PUTAWAY_TRIP_LABELS.errorCopy}
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data) return <PageSkeleton variant="detail" />;
  return (
    <WorkspaceRedirect warehouseId={query.data.warehouseId} path={WORKSPACE_PATHS.trip(tripId)} />
  );
}

/**
 * Link cũ `/admin/putaway/trip[?warehouse=]`: đang có chuyến → chuyến ở kho của nó (mỗi NV một chuyến mở trên mọi kho);
 * chưa có → mở chuyến ở kho trên link, không có kho thì về gốc tab để chọn kho.
 */
export function MyTripRedirect({ warehouseId }: { warehouseId: string | null }) {
  const query = useCurrentTrip();
  if (query.isPending) return <PageSkeleton variant="detail" />;
  return (
    <WorkspaceRedirect
      warehouseId={query.data?.warehouseId ?? warehouseId}
      path={WORKSPACE_PATHS.myTrip}
    />
  );
}
