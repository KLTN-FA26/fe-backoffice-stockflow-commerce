"use client";

import { useState } from "react";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { useCancelLoadBooking, useStartLoading } from "@/features/shipping/ftl-mutations";
import { cancelBookingInputSchema } from "@/features/shipping/input-schemas";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { Load } from "@/features/shipping/types";

const C = UI_LABELS.shipping.ftl.cancelBookingDialog;
const S = UI_LABELS.shipping.ftl.startDialog;

/** Huỷ đặt xe trước khi xếp hàng (BE `booking-cancellation`): xe về PLANNED, bắt buộc nêu lý do. */
export function CancelBookingDialog({ load, onClose }: { load: Load; onClose: () => void }) {
  const cancel = useCancelLoadBooking({ onSuccess: onClose });
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !cancel.isPending && onClose()}
      title={`${C.title} ${load.code}`}
      description={C.description}
      confirmLabel={C.confirm}
      requireReason
      reasonLabel={C.reason}
      reasonMaxLength={SHIPPING_LIMITS.cancelReasonMax}
      variant="danger"
      loading={cancel.isPending}
      closeOnConfirm={false}
      error={error}
      onConfirm={(reason) => {
        const parsed = cancelBookingInputSchema.safeParse({ reason });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? null);
          return;
        }
        setError(null);
        cancel.mutate(
          { loadId: load.loadId, reason: parsed.data.reason },
          { onError: (e) => setError(shippingErrorMessage(e)) },
        );
      }}
    />
  );
}

/** Xe đã tới kho → bắt đầu xếp hàng. BR-14: từ đây kế hoạch không mở lại / huỷ được → xác nhận trước. */
export function StartLoadingDialog({ load, onClose }: { load: Load; onClose: () => void }) {
  const start = useStartLoading({ onSuccess: onClose });
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !start.isPending && onClose()}
      title={`${S.title} ${load.code}`}
      description={S.description}
      confirmLabel={S.confirm}
      loading={start.isPending}
      closeOnConfirm={false}
      onConfirm={() => start.mutate({ loadId: load.loadId }, { onError: onClose })}
    />
  );
}
