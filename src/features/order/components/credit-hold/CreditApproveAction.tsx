"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { ORDER_LIMITS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { creditApprovalSchema } from "../../action-schemas";
import { useApproveCreditHold } from "../../mutations";
import { OrderRefusalAlert } from "../OrderRefusalAlert";

import { useCreditDecisionErrorHandler } from "./useCreditDecisionErrorHandler";

import type { CreditHoldTarget } from "./types";

/**
 * Duyệt vượt hạn mức công nợ (SCRUM-427, docs 14 BR-06) → đơn Confirmed. Chỉ người có
 * `sales-order-credit-holds:APPROVE` (ACCOUNTANT) thấy nút — gate ở `allowedOrderActions`.
 * BE bắt buộc ghi chú (CreditDecisionRequest.note @NotBlank).
 */
export function CreditApproveAction({
  order,
  compact = false,
}: {
  order: CreditHoldTarget;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        className={compact ? "rounded-[var(--r-sm)]" : "w-full rounded-[var(--r-sm)]"}
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 className="size-3.5" /> Duyệt vượt hạn mức
      </Button>
      <FormDialog open={open} onOpenChange={setOpen}>
        <ApproveForm order={order} onClose={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}

function ApproveForm({ order, onClose }: { order: CreditHoldTarget; onClose: () => void }) {
  const [note, setNote] = useState("");
  const { refusal, setRefusal, onError } = useCreditDecisionErrorHandler(onClose);
  const { mutate: approve, isPending } = useApproveCreditHold();
  const parsed = creditApprovalSchema.safeParse({ note });

  return (
    <FormDialogBody
      title="Duyệt vượt hạn mức công nợ"
      description={`Cho đơn ${order.orderNumber} đi tiếp dù vượt hạn mức tín dụng của khách. Đơn chuyển sang Đã xác nhận và có thể release.`}
      submitLabel="Duyệt"
      canSubmit={parsed.success}
      isPending={isPending}
      error={null}
      onSubmit={() => {
        if (!parsed.success) return;
        setRefusal(null);
        approve({ id: order.orderId, ...parsed.data }, { onSuccess: onClose, onError });
      }}
      onCancel={onClose}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="credit-approve-note" className="text-ink-secondary text-xs font-medium">
          Ghi chú duyệt <span className="text-danger">*</span>
        </Label>
        <Textarea
          id="credit-approve-note"
          value={note}
          maxLength={ORDER_LIMITS.creditNoteMax}
          autoFocus
          rows={3}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}
