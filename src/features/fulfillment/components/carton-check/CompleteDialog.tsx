"use client";

import { useState } from "react";

import { CARTON_CHECK_LIMITS, UI_LABELS } from "@/constants";
import { completeInputSchema } from "@/features/fulfillment/carton-check-input-schemas";
import { cartonCheckErrorMessage } from "@/features/fulfillment/carton-check-errors";
import { useCompleteCartonCheck } from "@/features/fulfillment/carton-check-mutations";
import { completionRequestId } from "@/features/fulfillment/carton-check-request-id";
import { completionReadiness } from "@/features/fulfillment/carton-check-selectors";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, MONO } from "../primitives";
import { CompleteModeOption } from "./CompleteModeOption";
import { CompletionResult } from "./CompletionResult";

import type { CartonCheckSession } from "@/features/fulfillment/carton-check-types";
import type { FulfillmentTask } from "@/features/fulfillment/types";

const C = UI_LABELS.cartonCheck.complete;

type Mode = "full" | "partial";

/**
 * Hoàn tất kiểm thùng (docs 08 §4.4 bước 8): các thùng đã dán nhãn chưa vào shipment thành một shipment. Đủ thùng cả
 * đơn, hoặc giao một phần kèm lý do bắt buộc (BR-01; đơn phải được Sale cho phép — BE `PACK_PARTIAL_NOT_ALLOWED`).
 * `requestId` nhớ theo task trong sessionStorage — bấm lại sau lỗi mạng gửi cùng id nên BE trả lại shipment đã tạo.
 */
export function CompleteDialog({
  session,
  onClose,
}: {
  session: CartonCheckSession;
  onClose: () => void;
}) {
  const ready = completionReadiness(session);
  const complete = useCompleteCartonCheck();
  const [mode, setMode] = useState<Mode>(ready.missing.length > 0 ? "partial" : "full");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<FulfillmentTask | null>(null);
  const blocked = ready.pending.length > 0 || ready.toShip.length === 0;

  const submit = () => {
    const parsed = completeInputSchema.safeParse({ mode, note });
    if (!parsed.success) {
      setNoteError(parsed.error.issues[0]?.message);
      return;
    }
    setServerError(null);
    complete.mutate(
      {
        taskId: session.taskId,
        requestId: completionRequestId(
          session.taskId,
          ready.toShip.map((carton) => carton.lpn),
        ),
        partial: mode === "partial",
        note: parsed.data.note || undefined,
      },
      {
        onSuccess: setResult,
        onError: (error) =>
          setServerError(cartonCheckErrorMessage(error, { starterName: session.startedByName })),
      },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={C.title}
        description={C.description}
        submitLabel={result ? C.close : mode === "partial" ? C.submitPartial : C.submitFull}
        canSubmit={!!result || !blocked}
        isPending={complete.isPending}
        error={serverError}
        hideCancel={!!result}
        onSubmit={result ? onClose : submit}
        onCancel={onClose}
      >
        {result ? (
          <CompletionResult session={session} task={result} />
        ) : (
          <>
            {ready.pending.length > 0 && (
              <Alert tone="danger" title={C.pendingTitle}>
                {C.pendingDescription(ready.pending.map((carton) => carton.lpn).join(", "))}
              </Alert>
            )}
            {ready.pending.length === 0 && ready.toShip.length === 0 && (
              <Alert tone="warning" title={C.nothingTitle}>
                {C.nothingDescription}
              </Alert>
            )}
            {ready.missing.length > 0 && (
              <div>
                <p className="text-ink-primary text-[0.8125rem] font-medium">{C.missingTitle}</p>
                <ul className="text-ink-secondary mt-1 text-[0.8125rem]">
                  {ready.missing.map((line) => (
                    <li key={line.orderLineId} className={MONO}>
                      {C.missingLine(line.sku, line.labeledUnits, line.wantedUnits)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2">
              <CompleteModeOption
                value="full"
                current={mode}
                label={C.modeFull}
                hint={
                  ready.missing.length > 0 ? C.fullBlocked(ready.missing.length) : C.modeFullHint
                }
                disabled={ready.missing.length > 0}
                onChange={setMode}
              />
              <CompleteModeOption
                value="partial"
                current={mode}
                label={C.modePartial}
                hint={ready.missing.length === 0 ? C.partialUnavailable : C.modePartialHint}
                disabled={ready.missing.length === 0}
                onChange={setMode}
              />
            </div>
            {mode === "partial" && (
              <div>
                <Label htmlFor="complete-note" className="text-[0.8125rem]">
                  {C.note}
                </Label>
                <Textarea
                  id="complete-note"
                  rows={3}
                  value={note}
                  maxLength={CARTON_CHECK_LIMITS.noteMax}
                  placeholder={C.notePlaceholder}
                  aria-invalid={noteError ? true : undefined}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setNoteError(undefined);
                    setServerError(null);
                  }}
                  className="border-border-default bg-bg-surface mt-1 rounded-[var(--r-sm)] text-[0.8125rem]"
                />
                <FieldError>{noteError}</FieldError>
              </div>
            )}
          </>
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
