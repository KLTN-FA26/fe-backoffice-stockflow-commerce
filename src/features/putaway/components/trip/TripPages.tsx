"use client";

import { ADMIN_ROUTES, PUTAWAY_TRIP_LABELS, PUTAWAY_TRIP_PERMISSIONS } from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useCurrentTrip, useTrip } from "@/features/putaway/trip-queries";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { TripStart } from "./TripStart";
import { TripView } from "./TripView";

import type { TripRouteMapSlot } from "./TripView";

const L = PUTAWAY_TRIP_LABELS;
const back = { href: ADMIN_ROUTES.putaway.list };

function MyTripContent({ routeMap }: { routeMap?: TripRouteMapSlot }) {
  const query = useCurrentTrip();
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (query.isError) {
    return (
      <LoadErrorState
        error={query.error}
        copy={L.errorCopy}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const refetch = () => void query.refetch();
  return query.data ? (
    <TripView trip={query.data} onStale={refetch} routeMap={routeMap} />
  ) : (
    <TripStart onStale={refetch} />
  );
}

function TripContent({ tripId, routeMap }: { tripId: string; routeMap?: TripRouteMapSlot }) {
  const query = useTrip(tripId);
  useBreadcrumbLabel(tripId, query.data ? L.title : undefined);
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (!query.data) {
    return (
      <LoadErrorState
        error={query.error}
        copy={L.errorCopy}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return <TripView trip={query.data} onStale={() => void query.refetch()} routeMap={routeMap} />;
}

/** "Chuyến của tôi" (docs 05 §4.5): chuyến đang mở của người dùng, chưa có thì mở chuyến mới. */
export function MyTripPage({ routeMap }: { routeMap?: TripRouteMapSlot }) {
  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{L.myTrip}</h1>
      <PermissionBoundary permissions={[PUTAWAY_TRIP_PERMISSIONS.read]} variant="detail">
        <MyTripContent routeMap={routeMap} />
      </PermissionBoundary>
    </div>
  );
}

/** Một chuyến theo id — để quản lý kho xem / đóng hộ chuyến bỏ dở của nhân viên khác (docs 05 §2). */
export function TripPage({ tripId, routeMap }: { tripId: string; routeMap?: TripRouteMapSlot }) {
  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{L.title}</h1>
      <PermissionBoundary permissions={[PUTAWAY_TRIP_PERMISSIONS.read]} variant="detail">
        <TripContent tripId={tripId} routeMap={routeMap} />
      </PermissionBoundary>
    </div>
  );
}
