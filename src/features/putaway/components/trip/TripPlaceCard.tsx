"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PackageCheck } from "lucide-react";
import { useForm } from "react-hook-form";

import { PUTAWAY_TRIP_ERROR_MESSAGES, PUTAWAY_TRIP_LABELS, PUTAWAY_TRIP_STATUS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { putawayConfirmError } from "@/features/putaway/errors";
import { tripErrorMessage } from "@/features/putaway/trip-errors";
import { usePlaceTripCarton } from "@/features/putaway/trip-mutations";
import { tripPlaceInputSchema } from "@/features/putaway/trip-schemas";

import { toast } from "@/components/shared/Toast";
import {
  DETAIL_ACTION_CLASS,
  DETAIL_CARD_CLASS,
  DetailCardTitle,
} from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { PutawayScanField } from "../detail/PutawayScanField";

import type { ReactNode } from "react";
import type { PutawayTrip, TripPlaceFormValues, TripPlaceValues } from "@/features/putaway/types";

const L = PUTAWAY_TRIP_LABELS.place;
const IDS = { locationCode: "trip-place-bin", lpn: "trip-place-lpn" } as const;
const focus = (id: string) => document.getElementById(id)?.focus();

interface PlaceError {
  message: string;
  stale: boolean;
  field?: "lpn" | "locationCode";
}

/**
 * Mã riêng của chuyến khi đặt thùng. `PUTAWAY_TRIP_ERROR_MESSAGES` còn chứa câu của bước xếp xe (MOVE_ACROSS_WAREHOUSES,
 * LOCATION_NOT_FOUND, PUTAWAY_TASK_NOT_FOUND nói về thùng) — khi đặt thùng các mã đó nói về bin quét được, nên đi qua
 * `putawayConfirmError` để lỗi nằm dưới ô bin.
 */
const PLACE_TRIP_CODES: ReadonlySet<string> = new Set<keyof typeof PUTAWAY_TRIP_ERROR_MESSAGES>([
  "PUTAWAY_TRIP_ALREADY_OPEN",
  "PUTAWAY_TRIP_NOT_FOUND",
  "PUTAWAY_TRIP_NOT_YOURS",
  "PUTAWAY_TRIP_INVALID_STATE",
  "PUTAWAY_TASK_ON_ANOTHER_TRIP",
  "PUTAWAY_CARTON_NOT_ON_TRIP",
]);

/** Lỗi đặt thùng: mã của chuyến (không trên xe, chuyến đổi) trước, còn lại là luật cứng của bin như cất một thùng. */
function placeError(error: unknown): PlaceError {
  if (error instanceof ApiError && PLACE_TRIP_CODES.has(error.code)) {
    const result = tripErrorMessage(error);
    return error.code === "PUTAWAY_CARTON_NOT_ON_TRIP" ? { ...result, field: "lpn" } : result;
  }
  return putawayConfirmError(error, null);
}

/**
 * Đặt thùng vào bin (IN_PROGRESS, docs 05 §4.5 bước 15): quét bin đang đứng trước → quét LPN → xác nhận. Thứ tự
 * điểm dừng không bắt buộc, bin khác bin gán vẫn được nếu nhận thùng (BR-07, BR-17).
 */
export function TripPlaceCard({
  trip,
  onStale,
  closeButton,
}: {
  trip: PutawayTrip;
  onStale: () => void;
  closeButton: ReactNode;
}) {
  const place = usePlaceTripCarton();
  const [attempt] = useState(() => createIdempotencyAttempt());
  const form = useForm<TripPlaceFormValues, unknown, TripPlaceValues>({
    resolver: zodResolver(tripPlaceInputSchema),
    defaultValues: { locationCode: "", lpn: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) => {
    if (place.isPending) return;
    place.mutate(
      { tripId: trip.id, values, idempotencyKey: attempt.keyFor({ tripId: trip.id, ...values }) },
      {
        onSuccess: (next) => {
          attempt.reset();
          form.reset({ locationCode: "", lpn: "" });
          // Thùng cuối → chuyến Completed: màn "Chuyến của tôi" về thẻ mở chuyến, nên báo rõ là đã xong
          toast.success(
            next.status === PUTAWAY_TRIP_STATUS.COMPLETED
              ? PUTAWAY_TRIP_LABELS.ended.COMPLETED
              : L.placed(values.lpn, values.locationCode),
          );
          focus(IDS.locationCode);
        },
        onError: (error) => {
          if (error instanceof ApiError) attempt.settle(error);
          else attempt.reset();
          const result = placeError(error);
          if (result.stale) {
            toast.error(result.message);
            onStale();
          } else if (result.field) {
            form.setError(result.field, { type: "server", message: result.message });
            focus(IDS[result.field]);
          } else toast.error(result.message);
        },
      },
    );
  });
  const bin = form.register("locationCode", { onChange: () => form.clearErrors("locationCode") });
  const lpn = form.register("lpn", { onChange: () => form.clearErrors("lpn") });
  return (
    <section className={DETAIL_CARD_CLASS} aria-labelledby="trip-place-title">
      <DetailCardTitle icon={PackageCheck}>
        <span id="trip-place-title">{L.title}</span>
      </DetailCardTitle>
      <form onSubmit={(event) => void submit(event)} className="space-y-3" noValidate>
        <PutawayScanField
          id={IDS.locationCode}
          label={L.bin}
          hint={L.binHint}
          error={errors.locationCode?.message}
          placeholder={L.binPlaceholder}
          autoFocus
          onKeyDown={(event) => {
            // Quét bin xong (Enter) → sang ô LPN, chưa gửi
            if (event.key === "Enter") {
              event.preventDefault();
              focus(IDS.lpn);
            }
          }}
          {...bin}
        />
        <PutawayScanField
          id={IDS.lpn}
          label={L.lpn}
          hint={L.lpnHint}
          error={errors.lpn?.message}
          placeholder={L.lpnPlaceholder}
          {...lpn}
        />
        <Button type="submit" disabled={place.isPending} className={DETAIL_ACTION_CLASS.primary}>
          {place.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {L.submit}
        </Button>
      </form>
      <div className="mt-2">{closeButton}</div>
    </section>
  );
}
