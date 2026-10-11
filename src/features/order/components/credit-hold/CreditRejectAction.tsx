"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { XCircle } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import {
  CREDIT_REJECTION_ACTION_LABELS,
  CREDIT_REJECTION_ACTIONS,
  ORDER_LIMITS,
  UI_LABELS,
} from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { creditDecisionErrorView } from "../../errors";
import { CREDIT_REJECTION_FORM_DEFAULTS, creditRejectionFormSchema } from "../../form-schemas";
import { useRejectCreditHold } from "../../mutations";
import { DANGER_OUTLINE_BUTTON } from "../button-styles";
import { FormFieldError, RequiredMark } from "../FormFieldError";
import { OrderRefusalAlert } from "../OrderRefusalAlert";
import { STALE_CODES, useOrderActionErrors } from "../useOrderActionErrors";

import { DepositPercentField } from "./DepositPercentField";

import type { CreditRejectionFormValues } from "../../form-schemas";
import type { CreditRejectionInput } from "../../types";
import type { CreditHoldTarget } from "./types";

const LABEL = "text-ink-secondary text-xs font-medium";

/**
 * Từ chối vượt hạn mức (SCRUM-427, docs 15 §4.3): huỷ đơn (CREDIT_REJECTED) hoặc chuyển khách
 * sang trả trước / đặt cọc → đơn về Chờ thanh toán. UI-only gate — Backend phải re-check
 * (CreditHoldController @RequiresPermission sales-order-credit-holds:APPROVE).
 */
export function CreditRejectAction({
  order,
  compact = false,
}: {
  order: CreditHoldTarget;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = UI_LABELS.order.actions.creditReject;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={compact ? `${label} vượt hạn mức đơn ${order.orderNumber}` : undefined}
        className={`${DANGER_OUTLINE_BUTTON} ${compact ? "" : "w-full"}`}
        onClick={() => setOpen(true)}
      >
        <XCircle className="size-3.5" /> {label}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen}>
        <RejectForm order={order} onClose={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}

function RejectForm({ order, onClose }: { order: CreditHoldTarget; onClose: () => void }) {
  const { refusal, clearRefusal, onError } = useOrderActionErrors(
    creditDecisionErrorView,
    STALE_CODES.credit,
    onClose,
  );
  const { mutate: reject, isPending } = useRejectCreditHold();
  const form = useForm<CreditRejectionFormValues, unknown, CreditRejectionInput>({
    resolver: zodResolver(creditRejectionFormSchema),
    mode: "onChange",
    defaultValues: CREDIT_REJECTION_FORM_DEFAULTS,
  });
  const action = useWatch({ control: form.control, name: "action" });
  const { errors } = form.formState;

  const submit = form.handleSubmit((input) => {
    clearRefusal();
    reject({ id: order.orderId, ...input }, { onSuccess: onClose, onError });
  });

  return (
    <FormDialogBody
      title="Từ chối vượt hạn mức công nợ"
      description={`Chọn cách xử lý đơn ${order.orderNumber} khi không duyệt vượt hạn mức.`}
      submitLabel="Từ chối"
      danger={action === "CANCEL"}
      canSubmit={form.formState.isValid}
      isPending={isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="credit-reject-action" className={LABEL}>
          Cách xử lý <RequiredMark />
        </Label>
        <Controller
          control={form.control}
          name="action"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id="credit-reject-action"
                autoFocus
                aria-required="true"
                className="w-full"
              >
                <SelectValue placeholder="Chọn cách xử lý" />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_REJECTION_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {CREDIT_REJECTION_ACTION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      {action === "SWITCH_TO_DEPOSIT" && (
        <DepositPercentField
          registration={form.register("depositPercent")}
          error={errors.depositPercent?.message}
        />
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="credit-reject-note" className={LABEL}>
          Ghi chú <RequiredMark />
        </Label>
        <Textarea
          id="credit-reject-note"
          maxLength={ORDER_LIMITS.creditNoteMax}
          rows={3}
          aria-required="true"
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? "credit-reject-note-error" : undefined}
          {...form.register("note")}
        />
        <FormFieldError id="credit-reject-note-error" message={errors.note?.message} />
      </div>
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}
