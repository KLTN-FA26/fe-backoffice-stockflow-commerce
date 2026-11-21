"use client";

import { useState } from "react";

import { PUTAWAY_TRIP_LABELS, PUTAWAY_TRIP_STATUS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth/auth-store";
import { tripActions } from "@/features/putaway/trip-lifecycle";
import {
  useCloseTrip,
  useForceCloseTrip,
  useReassignTripCarton,
  useUnloadTripCarton,
} from "@/features/putaway/trip-mutations";

import { DETAIL_GRID_CLASS } from "@/components/shared/DetailSection";

import { TripCartTable } from "./TripCartTable";
import { TripCloseButton } from "./TripCloseButton";
import { TripInfoSection } from "./TripInfoSection";
import { TripLoadCard } from "./TripLoadCard";
import { TripPlaceCard } from "./TripPlaceCard";
import { TripRouteSection } from "./TripRouteSection";
import { TripSideNote } from "./TripSideNote";
import { tripCallbacks } from "./useTripAction";

import type { PutawayTrip } from "@/features/putaway/types";

const L = PUTAWAY_TRIP_LABELS;

/**
 * Màn một chuyến cất hàng (docs 05 §4.5, trang chi tiết style Vercel). Trái: thông tin chuyến + thùng trên xe (LOADING
 * / đã kết thúc) hoặc lộ trình (IN_PROGRESS). Phải (góc trên): thẻ thao tác theo trạng thái — gate qua `tripActions`.
 */
export function TripView({ trip, onStale }: { trip: PutawayTrip; onStale: () => void }) {
  const can = usePermissionChecker();
  const me = useAuthStore((state) => state.user?.userId);
  const actions = tripActions(trip, me, can);
  const unload = useUnloadTripCarton();
  const reassign = useReassignTripCarton();
  const close = useCloseTrip();
  const forceClose = useForceCloseTrip();
  const [reassigning, setReassigning] = useState<string | null>(null);

  const closeButton = (
    <TripCloseButton
      trip={trip}
      pending={close.isPending}
      onConfirm={(done) => close.mutate({ tripId: trip.id }, tripCallbacks(onStale, done))}
    />
  );
  const endedText =
    trip.status === PUTAWAY_TRIP_STATUS.COMPLETED
      ? L.ended.COMPLETED
      : trip.status === PUTAWAY_TRIP_STATUS.CLOSED
        ? L.ended.CLOSED
        : null;
  const side = actions.load ? (
    <TripLoadCard
      trip={trip}
      departBlocked={actions.departBlocked}
      onStale={onStale}
      closeButton={closeButton}
    />
  ) : actions.place ? (
    <TripPlaceCard trip={trip} onStale={onStale} closeButton={closeButton} />
  ) : (
    <TripSideNote trip={trip} text={endedText ?? (trip.operatorId !== me ? L.notMine : L.readOnly)}>
      {actions.forceClose && (
        <TripCloseButton
          trip={trip}
          force
          pending={forceClose.isPending}
          onConfirm={(done) => forceClose.mutate({ tripId: trip.id }, tripCallbacks(onStale, done))}
        />
      )}
    </TripSideNote>
  );

  return (
    <div className={DETAIL_GRID_CLASS}>
      <div className="min-w-0 space-y-5">
        <TripInfoSection trip={trip} />
        {trip.status === PUTAWAY_TRIP_STATUS.IN_PROGRESS ? (
          <TripRouteSection
            trip={trip}
            pendingLpn={reassigning}
            onReassign={
              actions.place
                ? (lpn) => {
                    setReassigning(lpn);
                    reassign.mutate(
                      { tripId: trip.id, lpn },
                      tripCallbacks(onStale, () => setReassigning(null)),
                    );
                  }
                : undefined
            }
          />
        ) : (
          <TripCartTable
            cartons={trip.cartons}
            onUnload={
              actions.load
                ? (lpn) => {
                    // Chặn bấm đúp: lần thứ hai sẽ báo "thùng không có trên xe"
                    if (!unload.isPending)
                      unload.mutate({ tripId: trip.id, lpn }, tripCallbacks(onStale));
                  }
                : undefined
            }
            unloadPending={unload.isPending}
          />
        )}
      </div>
      <div className="space-y-5">{side}</div>
    </div>
  );
}
