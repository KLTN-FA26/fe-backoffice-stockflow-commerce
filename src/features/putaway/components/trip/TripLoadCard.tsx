"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PackagePlus, Play } from "lucide-react";
import { useForm } from "react-hook-form";

import { PUTAWAY_TRIP_LABELS } from "@/constants";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { tripErrorMessage } from "@/features/putaway/trip-errors";
import { useDepartTrip, useLoadTripCarton } from "@/features/putaway/trip-mutations";
import { tripLoadInputSchema } from "@/features/putaway/trip-schemas";

import { toast } from "@/components/shared/Toast";
import {
  DETAIL_ACTION_CLASS,
  DETAIL_CARD_CLASS,
  DetailCardTitle,
} from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { PutawayScanField } from "../detail/PutawayScanField";
import { tripCallbacks } from "./useTripAction";

import type { ReactNode } from "react";
import type { PutawayTrip, TripLoadValues } from "@/features/putaway/types";

const L = PUTAWAY_TRIP_LABELS.load;
const FIELD = "trip-load-lpn";

/**
 * Xếp thùng lên xe (LOADING, docs 05 §4.5 bước 11): quét LPN, Enter là xếp — con trỏ ở lại ô để quét thùng kế tiếp.
 * "Bắt đầu đi cất" khoá khi xe rỗng (§5: cần ≥ 1 thùng).
 */
export function TripLoadCard({
  trip,
  departBlocked,
  onStale,
  closeButton,
}: {
  trip: PutawayTrip;
  departBlocked: boolean;
  onStale: () => void;
  closeButton: ReactNode;
}) {
  const load = useLoadTripCarton();
  const depart = useDepartTrip();
  const [attempt] = useState(() => createIdempotencyAttempt());
  const form = useForm<TripLoadValues>({
    resolver: zodResolver(tripLoadInputSchema),
    defaultValues: { lpn: "" },
  });
  const submit = form.handleSubmit(({ lpn }) => {
    if (load.isPending) return;
    load.mutate(
      { tripId: trip.id, lpn, idempotencyKey: attempt.keyFor({ tripId: trip.id, lpn }) },
      {
        onSuccess: () => {
          attempt.reset();
          form.reset({ lpn: "" });
          document.getElementById(FIELD)?.focus();
        },
        onError: (error) => {
          attempt.reset();
          const result = tripErrorMessage(error);
          if (result.stale) {
            toast.error(result.message);
            onStale();
          } else form.setError("lpn", { type: "server", message: result.message });
        },
      },
    );
  });
  const field = form.register("lpn", { onChange: () => form.clearErrors("lpn") });
  return (
    <section className={DETAIL_CARD_CLASS} aria-labelledby="trip-load-title">
      <DetailCardTitle icon={PackagePlus}>
        <span id="trip-load-title">{L.title}</span>
      </DetailCardTitle>
      <form onSubmit={(event) => void submit(event)} className="space-y-3" noValidate>
        <PutawayScanField
          id={FIELD}
          label={L.field}
          hint={L.hint}
          error={form.formState.errors.lpn?.message}
          placeholder={L.placeholder}
          autoFocus
          {...field}
        />
      </form>
      <div className="mt-4 space-y-2">
        <Button
          type="button"
          disabled={departBlocked || depart.isPending}
          onClick={() => depart.mutate({ tripId: trip.id }, tripCallbacks(onStale))}
          className={DETAIL_ACTION_CLASS.primary}
        >
          {depart.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          {L.depart}
        </Button>
        <p className="text-ink-tertiary text-center text-xs">
          {departBlocked ? L.emptyCart : L.departHint}
        </p>
        {closeButton}
      </div>
    </section>
  );
}
