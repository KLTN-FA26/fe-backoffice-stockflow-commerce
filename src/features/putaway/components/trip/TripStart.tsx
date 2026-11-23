"use client";

import { useState } from "react";
import { Loader2, Route } from "lucide-react";

import { PUTAWAY_TRIP_LABELS, PUTAWAY_TRIP_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { useWorkspaceWarehouse } from "@/lib/workspace";
import { useOpenTrip } from "@/features/putaway/trip-mutations";

import { DETAIL_CARD_CLASS, DetailCardTitle } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { tripCallbacks } from "./useTripAction";

const L = PUTAWAY_TRIP_LABELS.start;
/** Nút chính của thẻ chi tiết — cỡ nút hành động chung (`--action-*`, skill vercel-restyle). */
const OPEN_BUTTON_CLASS =
  "border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse h-(--action-h) rounded-(--action-radius) border px-(--action-px) text-[0.8125rem] font-medium";

/** Chưa có chuyến mở: mở chuyến (LOADING) ở kho của tab theo kho — không có ô chọn kho (spec 2026-11-22 §5.8). */
export function TripStart({ onStale }: { onStale: () => void }) {
  const canOpen = useCan(PUTAWAY_TRIP_PERMISSIONS.update);
  const warehouseId = useWorkspaceWarehouse().id;
  const open = useOpenTrip();
  const [attempt] = useState(() => createIdempotencyAttempt());
  return (
    <section className={`${DETAIL_CARD_CLASS} mx-auto max-w-lg`} aria-labelledby="trip-start-title">
      <DetailCardTitle icon={Route}>
        <span id="trip-start-title">{L.title}</span>
      </DetailCardTitle>
      <p className="text-ink-secondary mb-4 text-[0.8125rem]">{L.description}</p>
      {canOpen ? (
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={open.isPending}
            onClick={() =>
              open.mutate(
                { warehouseId, idempotencyKey: attempt.keyFor({ warehouseId }) },
                tripCallbacks(onStale, () => attempt.reset()),
              )
            }
            className={OPEN_BUTTON_CLASS}
          >
            {open.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {L.submit}
          </Button>
        </div>
      ) : (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.noPermission}</p>
      )}
    </section>
  );
}
