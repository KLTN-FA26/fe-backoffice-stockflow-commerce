"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ORDER_LIMITS, UI_LABELS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { creditDecisionErrorView } from "../../errors";
import { CREDIT_APPROVAL_FORM_DEFAULTS, creditApprovalFormSchema } from "../../form-schemas";
import { useApproveCreditHold } from "../../mutations";
import { FormFieldError, RequiredMark } from "../FormFieldError";
import { OrderRefusalAlert } from "../OrderRefusalAlert";
import { STALE_CODES, useOrderActionErrors } from "../useOrderActionErrors";

import type { CreditApprovalFormValues } from "../../form-schemas";
import type { CreditApprovalInput } from "../../types";
import type { CreditHoldTarget } from "./types";

/**
 * Duyệt vượt hạn mức công nợ (SCRUM-427, docs 14 BR-06) → đơn Confirmed. Chỉ người có
 * `sales-order-credit-holds:APPROVE` (ACCOUNTANT) thấy nút — gate ở `allowedOrderActions`
 * (UI-only, Backend phải re-check: CreditHoldController @RequiresPermission APPROVE).
 * `compact`: trong hàng bảng — nhãn ngắn, aria-label kèm mã đơn để phân biệt giữa các hàng.
 */
export function CreditApproveAction({
  order,
  compact = false,
}: {
  order: CreditHoldTarget;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = UI_LABELS.order.actions.creditApprove;
  return (
    <>
      <Button
        type="button"
        size="sm"
        aria-label={compact ? `${label} đơn ${order.orderNumber}` : undefined}
        className={compact ? "rounded-[var(--r-sm)]" : "w-full rounded-[var(--r-sm)]"}
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 className="size-3.5" /> {compact ? "Duyệt" : label}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen}>
        <ApproveForm order={order} onClose={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}

function ApproveForm({ order, onClose }: { order: CreditHoldTarget; onClose: () => void }) {
  const { refusal, clearRefusal, onError } = useOrderActionErrors(
    creditDecisionErrorView,
    STALE_CODES.credit,
    onClose,
  );
  const { mutate: approve, isPending } = useApproveCreditHold();
  const form = useForm<CreditApprovalFormValues, unknown, CreditApprovalInput>({
    resolver: zodResolver(creditApprovalFormSchema),
    mode: "onTouched",
    defaultValues: CREDIT_APPROVAL_FORM_DEFAULTS,
  });
  const noteError = form.formState.errors.note?.message;

  const submit = form.handleSubmit((input) => {
    clearRefusal();
    approve({ id: order.orderId, ...input }, { onSuccess: onClose, onError });
  });

  return (
    <FormDialogBody
      title="Duyệt vượt hạn mức công nợ"
      description={`Cho đơn ${order.orderNumber} đi tiếp dù vượt hạn mức tín dụng của khách. Đơn chuyển sang Đã xác nhận và có thể release.`}
      submitLabel="Duyệt"
      canSubmit={form.formState.isValid}
      isPending={isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="credit-approve-note" className="text-ink-secondary text-xs font-medium">
          Ghi chú duyệt <RequiredMark />
        </Label>
        <Textarea
          id="credit-approve-note"
          maxLength={ORDER_LIMITS.creditNoteMax}
          autoFocus
          rows={3}
          aria-required="true"
          aria-invalid={noteError ? true : undefined}
          aria-describedby={noteError ? "credit-approve-note-error" : undefined}
          {...form.register("note")}
        />
        <FormFieldError id="credit-approve-note-error" message={noteError} />
      </div>
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}
