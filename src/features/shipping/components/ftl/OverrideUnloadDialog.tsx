"use client";

import { useState } from "react";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { useOverrideUnload } from "@/features/shipping/ftl-mutations";
import { overrideUnloadInputSchema } from "@/features/shipping/input-schemas";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { Load, PendingUnload } from "@/features/shipping/types";

const U = UI_LABELS.shipping.ftl.unload;

/**
 * Quản lý kho xác nhận một kiện đã dỡ khỏi xe KHÔNG cần quét vì nhãn hỏng (SCRUM-474 UNLOAD-DESIGN điểm 5): BE ghi người,
 * thời điểm và ghi chú. Chỉ mở khi người dùng có quyền huỷ có kiểm soát (nút do `UnloadPanel` gate). Backend phải re-check.
 */
export function OverrideUnloadDialog({
  load,
  item,
  onClose,
}: {
  load: Load;
  item: PendingUnload;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const override = useOverrideUnload({ onSuccess: onClose });

  const submit = () => {
    const parsed = overrideUnloadInputSchema.safeParse({ note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setError(null);
    override.mutate(
      { loadId: load.loadId, packageId: item.packageId, note: parsed.data.note },
      { onError: (e) => setError(shippingErrorMessage(e)) },
    );
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !override.isPending && onClose()}
      title={`${U.overrideTitle} ${item.labelCode}`}
      description={U.overrideDescription}
      confirmLabel={U.overrideConfirm}
      variant="danger"
      loading={override.isPending}
      closeOnConfirm={false}
      error={error}
      onConfirm={submit}
    >
      <div className="space-y-1.5">
        <Label htmlFor="override-unload-note" className="text-[0.8125rem] font-medium">
          {U.overrideNote}
        </Label>
        <Textarea
          id="override-unload-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={SHIPPING_LIMITS.noteMax}
          rows={2}
          className="border-border-default bg-bg-surface rounded-[var(--r-sm)]"
        />
      </div>
    </ConfirmDialog>
  );
}
