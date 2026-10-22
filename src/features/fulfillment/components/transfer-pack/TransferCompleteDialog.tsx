"use client";

import { useState } from "react";

import { TRANSFER_PACK_LIMITS, UI_LABELS } from "@/constants";
import { transferCompleteInputSchema } from "@/features/fulfillment/transfer-pack-input-schemas";
import { transferPackErrorMessage } from "@/features/fulfillment/transfer-pack-errors";
import { useCompleteTransferPack } from "@/features/fulfillment/transfer-pack-mutations";
import { transferCompletionReadiness } from "@/features/fulfillment/transfer-pack-selectors";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, MONO } from "../primitives";
import { CompleteModeOption } from "./CompleteModeOption";

import type { TransferPackSession } from "@/features/fulfillment/transfer-pack-types";

const C = UI_LABELS.transferPack.complete;

import type { CompleteMode as Mode } from "./CompleteModeOption";

/**
 * Hoàn tất đóng gói chuyển kho (BE `POST …/completion`): đóng đủ số yêu cầu, hoặc chỉ chuyển phần đã đóng kèm lý do
 * (`partial` + `note`; lệnh chuyển đúng số đã đóng). BE vẫn quyết (409 `PACKAGE_NOT_SEALED`, `PACKING_INCOMPLETE`,
 * `KIT_INCOMPLETE`); dialog chỉ chặn sớm các điều kiện nhìn thấy được từ phiên.
 */
export function TransferCompleteDialog({
  session,
  onClose,
}: {
  session: TransferPackSession;
  onClose: () => void;
}) {
  const ready = transferCompletionReadiness(session);
  const complete = useCompleteTransferPack();
  const [mode, setMode] = useState<Mode>(ready.canFull ? "full" : "partial");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const canSubmit = mode === "full" ? ready.canFull : ready.canPartial;

  const submit = () => {
    const parsed = transferCompleteInputSchema.safeParse({ mode, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    complete.mutate(
      { packId: session.packId, partial: parsed.data.mode === "partial", note: parsed.data.note },
      { onSuccess: onClose, onError: (e) => setServerError(transferPackErrorMessage(e)) },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={C.title}
        description={C.description}
        submitLabel={C.submit}
        canSubmit={canSubmit}
        isPending={complete.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        {ready.openWithGoods.length > 0 && <Alert tone="warning">{C.notReadyOpen}</Alert>}
        {ready.sealed.length === 0 && ready.openWithGoods.length === 0 && (
          <Alert tone="warning">{C.notReadyNone}</Alert>
        )}
        <div className="space-y-2">
          <CompleteModeOption
            value="full"
            current={mode}
            label={C.full}
            hint={C.fullHint}
            disabled={!ready.canFull}
            onChange={setMode}
          />
          <CompleteModeOption
            value="partial"
            current={mode}
            label={C.partial}
            hint={C.partialHint}
            disabled={ready.missing.length === 0}
            onChange={setMode}
          />
        </div>
        {ready.missing.length > 0 && (
          <div className="text-ink-secondary text-xs">
            <div className="text-ink-primary font-medium">{C.missingTitle}</div>
            <ul className={MONO}>
              {ready.missing.map((line) => (
                <li key={line.transferLineId}>{C.missingLine(line.sku, line.remaining)}</li>
              ))}
            </ul>
          </div>
        )}
        {mode === "partial" && (
          <div>
            <Label htmlFor="transfer-complete-note" className="text-[0.8125rem]">
              {C.note}
            </Label>
            <Textarea
              id="transfer-complete-note"
              rows={3}
              value={note}
              maxLength={TRANSFER_PACK_LIMITS.noteMax}
              placeholder={C.notePlaceholder}
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setNote(event.target.value);
                setError(null);
              }}
            />
            <FieldError>{error ?? undefined}</FieldError>
          </div>
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
