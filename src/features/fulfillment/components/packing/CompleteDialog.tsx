"use client";

import { useState } from "react";

import { PACKING_LIMITS, UI_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { completeInputSchema } from "@/features/fulfillment/packing-input-schemas";
import { packingErrorMessage } from "@/features/fulfillment/packing-errors";
import { useCompletePacking } from "@/features/fulfillment/packing-mutations";
import { completionReadiness } from "@/features/fulfillment/packing-selectors";
import { completionRequestId } from "@/features/fulfillment/packing-request-id";
import { isOnDesignHold } from "@/features/fulfillment/selectors";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, MONO } from "../primitives";

import type { PackingSession } from "@/features/fulfillment/packing-types";
import type { FulfillmentTask } from "@/features/fulfillment/types";

const C = UI_LABELS.packing.complete;

type Mode = "full" | "partial";

function ModeOption({
  value,
  current,
  label,
  hint,
  disabled,
  onChange,
}: {
  value: Mode;
  current: Mode;
  label: string;
  hint: string;
  disabled: boolean;
  onChange: (mode: Mode) => void;
}) {
  return (
    <label
      className={`border-border-default flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border p-2.5 ${disabled ? "opacity-60" : ""}`}
    >
      <input
        type="radio"
        name="complete-mode"
        value={value}
        checked={current === value}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="accent-brand mt-1"
      />
      <span>
        <span className="text-ink-primary block text-[0.8125rem] font-medium">{label}</span>
        <span className="text-ink-secondary block text-xs">{hint}</span>
      </span>
    </label>
  );
}

/** Kết quả sau khi hoàn tất: lô giao vừa tạo, hoặc phiên bị giữ do lệch thiết kế, kèm cảnh báo thu tiền. */
function CompletionResult({ session, task }: { session: PackingSession; task: FulfillmentTask }) {
  if (isOnDesignHold(task)) {
    return (
      <Alert tone="danger" title={C.resultHeld}>
        {C.resultHeldHint}
      </Alert>
    );
  }
  const shipment = session.shipments.find((candidate) => candidate.shipmentId === task.shipmentId);
  const due = task.paymentDue;
  return (
    <div className="space-y-3">
      <Alert tone="info" title={C.resultShipped}>
        {shipment ? (
          <>
            <span className={MONO}>{shipment.code}</span> ·{" "}
            {C.resultPackages(shipment.packageCount)}.{" "}
          </>
        ) : (
          <>{C.resultLoading} </>
        )}
        {task.packStatus === "Packed" ? C.resultShippedFull : C.resultShippedPartial}
      </Alert>
      {due && due.amountDueBeforeHandover > 0 && (
        <Alert tone="warning" title={UI_LABELS.packing.notice.paymentTitle}>
          {UI_LABELS.packing.notice.paymentDescription(
            formatMoney(due.amountDueBeforeHandover, due.currency),
          )}
        </Alert>
      )}
    </div>
  );
}

/**
 * Hoàn tất đóng gói (docs 08 bước 7–9): mọi kiện đã niêm phong và chưa giao thành một lô giao. Đóng đủ
 * cả đơn, hoặc giao một phần kèm lý do bắt buộc (BR-01). `requestId` nhớ theo task trong sessionStorage
 * — bấm lại sau lỗi mạng gửi cùng id nên BE trả lại lô đã tạo thay vì tạo lô thứ hai.
 */
export function CompleteDialog({
  session,
  onClose,
}: {
  session: PackingSession;
  onClose: () => void;
}) {
  const ready = completionReadiness(session);
  const complete = useCompletePacking();
  const [mode, setMode] = useState<Mode>(ready.missing.length > 0 ? "partial" : "full");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<FulfillmentTask | null>(null);
  const blocked = ready.openWithGoods.length > 0 || ready.sealed.length === 0;

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
        requestId: completionRequestId(session.taskId),
        partial: mode === "partial",
        note: parsed.data.note || undefined,
      },
      {
        onSuccess: setResult,
        onError: (error) =>
          setServerError(packingErrorMessage(error, { packerName: session.packerName })),
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
            {ready.openWithGoods.length > 0 && (
              <Alert tone="danger" title={C.openPackagesTitle}>
                {C.openPackagesDescription(
                  ready.openWithGoods
                    .map((pkg) => UI_LABELS.packing.packages.cardTitle(pkg.packageNo))
                    .join(", "),
                )}
              </Alert>
            )}
            {ready.openWithGoods.length === 0 && ready.sealed.length === 0 && (
              <Alert tone="warning" title={C.nothingSealedTitle}>
                {C.nothingSealedDescription}
              </Alert>
            )}
            {ready.missing.length > 0 && (
              <div>
                <p className="text-ink-primary text-[0.8125rem] font-medium">{C.missingTitle}</p>
                <ul className="text-ink-secondary mt-1 text-[0.8125rem]">
                  {ready.missing.map((line) => (
                    <li key={line.orderLineId} className={MONO}>
                      {line.sku}: {line.packed}/{line.wanted}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2">
              <ModeOption
                value="full"
                current={mode}
                label={C.modeFull}
                hint={
                  ready.missing.length > 0 ? C.fullBlocked(ready.missing.length) : C.modeFullHint
                }
                disabled={ready.missing.length > 0}
                onChange={setMode}
              />
              <ModeOption
                value="partial"
                current={mode}
                label={C.modePartial}
                hint={C.modePartialHint}
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
                  maxLength={PACKING_LIMITS.noteMax}
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
