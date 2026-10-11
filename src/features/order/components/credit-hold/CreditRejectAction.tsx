"use client";

import { XCircle } from "lucide-react";
import { useState } from "react";

import {
  CREDIT_REJECTION_ACTION_LABELS,
  CREDIT_REJECTION_ACTIONS,
  ORDER_LIMITS,
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

import { creditRejectionSchema } from "../../action-schemas";
import { useRejectCreditHold } from "../../mutations";
import { OrderRefusalAlert } from "../OrderRefusalAlert";

import { DepositPercentField } from "./DepositPercentField";
import { useCreditDecisionErrorHandler } from "./useCreditDecisionErrorHandler";

import type { CreditRejectionAction } from "@/constants";
import type { CreditHoldTarget } from "./types";

const LABEL = "text-ink-secondary text-xs font-medium";

function isAction(value: string): value is CreditRejectionAction {
  return (CREDIT_REJECTION_ACTIONS as readonly string[]).includes(value);
}

/**
 * Từ chối vượt hạn mức (SCRUM-427, docs 15 §4.3): huỷ đơn (CREDIT_REJECTED) hoặc chuyển khách
 * sang trả trước / đặt cọc → đơn về Chờ thanh toán. Huỷ là thao tác phá huỷ → nút đỏ.
 */
export function CreditRejectAction({
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
        variant="outline"
        size="sm"
        className={`border-danger text-danger hover:bg-danger/10 rounded-[var(--r-sm)] bg-transparent ${compact ? "" : "w-full"}`}
        onClick={() => setOpen(true)}
      >
        <XCircle className="size-3.5" /> Từ chối
      </Button>
      <FormDialog open={open} onOpenChange={setOpen}>
        <RejectForm order={order} onClose={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}

function RejectForm({ order, onClose }: { order: CreditHoldTarget; onClose: () => void }) {
  const [action, setAction] = useState<CreditRejectionAction | "">("");
  const [depositPercent, setDepositPercent] = useState("");
  const [note, setNote] = useState("");
  const { refusal, setRefusal, onError } = useCreditDecisionErrorHandler(onClose);
  const { mutate: reject, isPending } = useRejectCreditHold();
  const parsed = creditRejectionSchema.safeParse({
    action: action || undefined,
    // Bỏ trống → BE dùng % cọc mặc định của hồ sơ công nợ khách
    depositPercent: depositPercent.trim() === "" ? undefined : Number(depositPercent),
    note,
  });
  const percentError = parsed.error?.issues.find((i) => i.path[0] === "depositPercent")?.message;

  return (
    <FormDialogBody
      title="Từ chối vượt hạn mức công nợ"
      description={`Chọn cách xử lý đơn ${order.orderNumber} khi không duyệt vượt hạn mức.`}
      submitLabel="Từ chối"
      danger={action === "CANCEL"}
      canSubmit={parsed.success}
      isPending={isPending}
      error={null}
      onSubmit={() => {
        if (!parsed.success) return;
        setRefusal(null);
        reject({ id: order.orderId, ...parsed.data }, { onSuccess: onClose, onError });
      }}
      onCancel={onClose}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="credit-reject-action" className={LABEL}>
          Cách xử lý <span className="text-danger">*</span>
        </Label>
        <Select value={action} onValueChange={(v) => setAction(isAction(v) ? v : "")}>
          <SelectTrigger id="credit-reject-action" autoFocus className="w-full">
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
      </div>
      {action === "SWITCH_TO_DEPOSIT" && (
        <DepositPercentField
          value={depositPercent}
          error={percentError}
          onChange={setDepositPercent}
        />
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="credit-reject-note" className={LABEL}>
          Ghi chú <span className="text-danger">*</span>
        </Label>
        <Textarea
          id="credit-reject-note"
          value={note}
          maxLength={ORDER_LIMITS.creditNoteMax}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}
