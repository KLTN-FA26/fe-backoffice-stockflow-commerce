"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { XCircle } from "lucide-react";

import { ORDER_LIMITS, UI_LABELS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { CREDIT_REJECTION_FIELD_ERRORS, creditDecisionErrorView } from "../../errors";
import { CREDIT_REJECTION_FORM_DEFAULTS, creditRejectionFormSchema } from "../../form-schemas";
import { useRejectCreditHold } from "../../mutations";
import { DANGER_OUTLINE_BUTTON } from "../button-styles";
import { FormFieldError, RequiredMark } from "../FormFieldError";
import { OrderRefusalAlert } from "../OrderRefusalAlert";
import { STALE_CODES, useOrderActionErrors } from "../useOrderActionErrors";
import { usePendingSafeDialog } from "../usePendingSafeDialog";

import { CreditPositionPanel } from "./CreditPositionPanel";
import { useCustomerCreditPosition } from "./useCustomerCreditPosition";

import type { CreditRejectionFormValues } from "../../form-schemas";
import type { CreditRejectionInput } from "../../types";
import type { CreditHoldTarget } from "./types";

/**
 * Từ chối tín dụng (docs 15 §4.3, BE `CreditRefusalRequest {note}`): đơn bị HUỶ (CREDIT_REJECTED), tiền đã thu
 * thành số phải hoàn. Không còn chuyển trả trước / đặt cọc. Sau khi từ chối, màn cha hiện "Phải hoàn" (`onRejected`).
 * UI-only gate — Backend phải re-check (CreditHoldController @RequiresPermission sales-order-credit-holds:APPROVE).
 */
export function CreditRejectAction({
  order,
  compact = false,
  onRejected,
}: {
  order: CreditHoldTarget;
  compact?: boolean;
  /** Hàng đợi: dòng biến mất khi tải lại → màn cha giữ kết quả để hiện số phải hoàn. */
  onRejected?: (order: CreditHoldTarget) => void;
}) {
  // Mutation ở đây (không ở form) để Esc / bấm ra ngoài không đóng dialog khi đang gửi
  const mutation = useRejectCreditHold();
  const dialog = usePendingSafeDialog(mutation.isPending);
  const label = UI_LABELS.order.actions.creditReject;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={compact ? `${label} duyệt công nợ đơn ${order.orderNumber}` : undefined}
        className={`${DANGER_OUTLINE_BUTTON} ${compact ? "" : "w-full"}`}
        onClick={dialog.show}
      >
        <XCircle className="size-3.5" /> {label}
      </Button>
      <FormDialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
        <RejectForm
          order={order}
          mutation={mutation}
          onClose={dialog.close}
          onRejected={onRejected}
        />
      </FormDialog>
    </>
  );
}

function RejectForm({
  order,
  mutation,
  onClose,
  onRejected,
}: {
  order: CreditHoldTarget;
  mutation: ReturnType<typeof useRejectCreditHold>;
  onClose: () => void;
  onRejected?: (order: CreditHoldTarget) => void;
}) {
  const { mutate: reject, isPending } = mutation;
  const position = useCustomerCreditPosition(order.customerId);
  const form = useForm<CreditRejectionFormValues, unknown, CreditRejectionInput>({
    resolver: zodResolver(creditRejectionFormSchema),
    mode: "onTouched",
    defaultValues: CREDIT_REJECTION_FORM_DEFAULTS,
  });
  const { refusal, clearRefusal, onError, beginSubmit, idempotencyKeyFor, finishAttempt } =
    useOrderActionErrors(creditDecisionErrorView, STALE_CODES.credit, onClose, {
      map: CREDIT_REJECTION_FIELD_ERRORS,
      setError: (field, message) => form.setError(field, { type: "server", message }),
    });
  const noteError = form.formState.errors.note?.message;

  const submit = form.handleSubmit((input) => {
    if (!beginSubmit()) return;
    clearRefusal();
    const variables = { id: order.orderId, note: input.note };
    reject(
      { ...variables, idempotencyKey: idempotencyKeyFor(variables) },
      {
        onSuccess: () => {
          finishAttempt();
          onRejected?.(order);
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <FormDialogBody
      title="Từ chối tín dụng"
      description={`Đơn ${order.orderNumber} sẽ bị huỷ. Tiền đã thu (nếu có) chuyển thành số tiền phải hoàn.`}
      submitLabel="Từ chối và huỷ đơn"
      canSubmit={form.formState.isValid}
      isPending={isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="credit-reject-note" className="text-ink-secondary text-xs font-medium">
          Ghi chú <RequiredMark />
        </Label>
        <Textarea
          id="credit-reject-note"
          maxLength={ORDER_LIMITS.creditNoteMax}
          autoFocus
          rows={3}
          aria-required="true"
          aria-invalid={noteError ? true : undefined}
          aria-describedby={noteError ? "credit-reject-note-error" : undefined}
          {...form.register("note")}
        />
        <FormFieldError id="credit-reject-note-error" message={noteError} />
      </div>
      <CreditPositionPanel state={position} />
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}
