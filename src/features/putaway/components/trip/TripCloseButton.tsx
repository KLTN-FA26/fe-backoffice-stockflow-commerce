"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";

import { PUTAWAY_TRIP_LABELS, PUTAWAY_TRIP_STATUS } from "@/constants";
import { tripProgress } from "@/features/putaway/trip-selectors";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DETAIL_ACTION_CLASS } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import type { PutawayTrip } from "@/features/putaway/types";

const L = PUTAWAY_TRIP_LABELS.close;

/**
 * Đóng chuyến (hành động phá huỷ → `ConfirmDialog`): thùng còn trên xe trả về hàng chờ cất (docs 05 §5). `force`:
 * quản lý kho đóng chuyến bỏ dở của người khác (§2).
 */
export function TripCloseButton({
  trip,
  force = false,
  pending,
  onConfirm,
}: {
  trip: PutawayTrip;
  force?: boolean;
  pending: boolean;
  onConfirm: (done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const { onCart } = tripProgress(trip);
  const label = force
    ? L.force
    : trip.status === PUTAWAY_TRIP_STATUS.LOADING
      ? L.loadingAction
      : L.action;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => setOpen(true)}
        className={DETAIL_ACTION_CLASS.danger}
      >
        <XCircle className="size-3.5" />
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={L.title}
        description={force ? L.forceDescription(onCart) : L.description(onCart)}
        confirmLabel={label}
        variant="danger"
        loading={pending}
        closeOnConfirm={false}
        onConfirm={() => onConfirm(() => setOpen(false))}
      />
    </>
  );
}
