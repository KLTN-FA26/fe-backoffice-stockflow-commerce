"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PackageX } from "lucide-react";
import { useCallback, useId } from "react";
import { useForm } from "react-hook-form";

import { DELIVERY_FAILURE_LIMITS, LOST_SHIPMENT_CLOSURE_LABELS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  LOST_CLOSURE_FIELD_ERRORS,
  LOST_CLOSURE_STALE_CODES,
  deliveryFailureErrorView,
  lostEvidenceUploadErrorMessage,
} from "../../delivery-failure-errors";
import { useCloseLostShipment } from "../../delivery-failure-mutations";
import { LOST_CLOSURE_DEFAULTS, lostClosureInputSchema } from "../../delivery-failure-schemas";
import { beginLostEvidenceUpload } from "../../lost-closure-api";
import { DANGER_OUTLINE_BUTTON } from "../button-styles";
import { useEvidenceUpload } from "../delivery-schedule/useEvidenceUpload";
import { WindowEvidenceFile } from "../delivery-schedule/WindowEvidenceFile";
import { FormFieldError, RequiredMark } from "../FormFieldError";
import { OrderRefusalAlert } from "../OrderRefusalAlert";
import { useOrderActionErrors } from "../useOrderActionErrors";
import { usePendingSafeDialog } from "../usePendingSafeDialog";

import type { LostClosureFormValues, LostClosureValues } from "../../delivery-failure-schemas";

const L = LOST_SHIPMENT_CLOSURE_LABELS;

interface LostTarget {
  orderId: string;
  orderNumber: string;
  shipmentId: string;
  /** "Lô 2" — tên lô như trên thẻ lô giao. */
  shipmentLabel: string;
}

/**
 * "Đóng phần thất lạc" (WF-05 Q-12, BE-17; F-5): lô hãng báo thất lạc không bao giờ về kho. Đóng phần hàng của lô kèm tệp
 * xác nhận thất lạc của hãng; tiền tính ngay như hàng hoàn về. Không hoàn tác được. Gate: `canCloseLostShipment`. UI-only
 * — Backend phải re-check (`sales-lost-shipment-closures:APPROVE`, ORDER_SHIPMENT_NOT_LOST_CLOSABLE).
 */
export function LostShipmentClosureAction({ target }: { target: LostTarget }) {
  const mutation = useCloseLostShipment();
  const dialog = usePendingSafeDialog(mutation.isPending);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={DANGER_OUTLINE_BUTTON}
        aria-label={`${L.button} · ${target.shipmentLabel}`}
        onClick={dialog.show}
      >
        <PackageX className="size-3.5" /> {L.button}
      </Button>
      <FormDialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
        <LostClosureForm target={target} mutation={mutation} onClose={dialog.close} />
      </FormDialog>
    </>
  );
}

function LostClosureForm({
  target,
  mutation,
  onClose,
}: {
  target: LostTarget;
  mutation: ReturnType<typeof useCloseLostShipment>;
  onClose: () => void;
}) {
  const ids = useId();
  const form = useForm<LostClosureFormValues, unknown, LostClosureValues>({
    resolver: zodResolver(lostClosureInputSchema),
    mode: "onTouched",
    defaultValues: LOST_CLOSURE_DEFAULTS,
  });
  const errors = useOrderActionErrors(
    (error) => deliveryFailureErrorView(error, "lost-closure"),
    LOST_CLOSURE_STALE_CODES,
    onClose,
    {
      map: LOST_CLOSURE_FIELD_ERRORS,
      setError: (field, message) => form.setError(field, { type: "server", message }),
    },
  );
  const { setValue } = form;
  // Tệp tải xong → id vào form; bắt đầu tệp mới / bỏ tệp / lỗi → "" (chưa có bằng chứng)
  const setUploadId = useCallback(
    (uploadId: string) => setValue("evidenceUploadId", uploadId, { shouldValidate: true }),
    [setValue],
  );
  const upload = useEvidenceUpload(
    (declaration, signal) =>
      beginLostEvidenceUpload(target.orderId, target.shipmentId, declaration, signal),
    setUploadId,
    lostEvidenceUploadErrorMessage,
  );
  const noteError = form.formState.errors.note?.message;
  const evidenceError = form.formState.errors.evidenceUploadId?.message;
  const uploading = upload.state.status === "running";

  const submit = form.handleSubmit((values) => {
    if (!errors.beginSubmit()) return;
    errors.clearRefusal();
    const variables = { orderId: target.orderId, shipmentId: target.shipmentId, ...values };
    mutation.mutate(
      { ...variables, idempotencyKey: errors.idempotencyKeyFor(variables) },
      {
        onSuccess: () => {
          errors.finishAttempt();
          onClose();
        },
        onError: errors.onError,
      },
    );
  });

  return (
    <FormDialogBody
      title={`${L.title} · ${target.orderNumber}`}
      description={L.description(target.shipmentLabel)}
      submitLabel={L.submit}
      danger
      canSubmit={form.formState.isValid && !uploading}
      isPending={mutation.isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${ids}-note`} className="text-ink-secondary text-xs font-medium">
          {L.note} <RequiredMark />
        </Label>
        <Textarea
          id={`${ids}-note`}
          rows={3}
          autoFocus
          maxLength={DELIVERY_FAILURE_LIMITS.noteMax}
          placeholder={L.notePlaceholder}
          aria-required="true"
          aria-invalid={noteError ? true : undefined}
          aria-describedby={noteError ? `${ids}-note-error` : undefined}
          {...form.register("note")}
        />
        <FormFieldError id={`${ids}-note-error`} message={noteError} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${ids}-file`} className="text-ink-secondary text-xs font-medium">
          {L.evidence} <RequiredMark />
        </Label>
        <p id={`${ids}-hint`} className="text-ink-tertiary text-xs">
          {L.evidenceHint}
        </p>
        <WindowEvidenceFile upload={upload} inputId={`${ids}-file`} describedBy={`${ids}-hint`} />
        <FormFieldError id={`${ids}-file-error`} message={evidenceError} />
      </div>
      {errors.refusal && <OrderRefusalAlert view={errors.refusal} />}
    </FormDialogBody>
  );
}
