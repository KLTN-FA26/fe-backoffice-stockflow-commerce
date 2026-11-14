"use client";

import { useState } from "react";

import { CARTON_CHECK_LIMITS, UI_LABELS } from "@/constants";
import { removalInputSchema } from "@/features/fulfillment/carton-check-input-schemas";
import { cartonCheckErrorMessage } from "@/features/fulfillment/carton-check-errors";
import { useRemoveCarton } from "@/features/fulfillment/carton-check-mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "../primitives";

import type { Carton, CartonCheckSession } from "@/features/fulfillment/carton-check-types";

const R = UI_LABELS.cartonCheck.remove;

/**
 * Loại thùng hư hỏng bên ngoài khỏi đơn (docs 08 §4.2 bước 4): thùng thành Removed và vào hàng chờ cất lại để cất nguyên
 * thùng vào khu QUARANTINE. Ghi chú tình trạng (≤ 500 ký tự) không bắt buộc, kèm theo thùng cho người cất.
 */
export function RemoveCartonDialog({
  session,
  carton,
  onClose,
}: {
  session: CartonCheckSession;
  carton: Carton;
  onClose: () => void;
}) {
  const remove = useRemoveCarton();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = () => {
    const parsed = removalInputSchema.safeParse({ note });
    if (!parsed.success) {
      setNoteError(parsed.error.issues[0]?.message);
      return;
    }
    setServerError(null);
    remove.mutate(
      { taskId: session.taskId, lpn: carton.lpn, note: parsed.data.note || undefined },
      {
        onSuccess: onClose,
        onError: (error) =>
          setServerError(cartonCheckErrorMessage(error, { starterName: session.startedByName })),
      },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={R.title(carton.lpn)}
        description={R.description}
        submitLabel={R.submit}
        canSubmit
        isPending={remove.isPending}
        error={serverError}
        danger
        onSubmit={submit}
        onCancel={onClose}
      >
        <div>
          <Label htmlFor="remove-note" className="text-[0.8125rem]">
            {R.note}
          </Label>
          <Textarea
            id="remove-note"
            rows={3}
            value={note}
            maxLength={CARTON_CHECK_LIMITS.noteMax}
            placeholder={R.notePlaceholder}
            aria-invalid={noteError ? true : undefined}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteError(undefined);
              setServerError(null);
            }}
            className="border-border-default bg-bg-surface mt-1 rounded-[var(--r-sm)] text-[0.8125rem]"
          />
          <p className="text-ink-tertiary mt-1 text-xs">{R.noteHint}</p>
          <FieldError>{noteError}</FieldError>
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
