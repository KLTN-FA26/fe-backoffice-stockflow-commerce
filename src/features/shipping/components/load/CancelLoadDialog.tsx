"use client";

import { useState } from "react";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { cancelLoadInputSchema } from "@/features/shipping/input-schemas";
import { useCancelLoad } from "@/features/shipping/mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { Load } from "@/features/shipping/types";

const D = UI_LABELS.shipping.load.cancelDialog;

/** Huỷ chuyến chưa rời kho (quản lý kho): các lô và kiện đã quét về khu chờ xuất; bắt buộc nêu lý do. */
export function CancelLoadDialog({ load, onClose }: { load: Load; onClose: () => void }) {
  // Callback mức hook: ghi cache đưa chuyến sang CANCELLED có thể gỡ hộp thoại này trước callback của `mutate`
  const cancel = useCancelLoad({ onSuccess: onClose });
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !cancel.isPending && onClose()}
      title={`${D.title} ${load.code}`}
      description={D.description}
      confirmLabel={D.confirm}
      requireReason
      reasonLabel={D.reason}
      reasonMaxLength={SHIPPING_LIMITS.cancelReasonMax}
      variant="danger"
      loading={cancel.isPending}
      closeOnConfirm={false}
      error={error}
      onConfirm={(reason) => {
        const parsed = cancelLoadInputSchema.safeParse({ reason });
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
