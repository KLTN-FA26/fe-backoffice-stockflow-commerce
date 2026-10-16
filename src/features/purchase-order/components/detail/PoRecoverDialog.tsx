"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { toLocalIsoDate } from "@/lib/format";
import { PO_REASON_MAX, recoverDeliveryInputSchema } from "@/features/purchase-order";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { PoDialog, PoDialogForm } from "./PoDialog";

import type { PurchaseOrder, RecoverDeliveryInput } from "@/features/purchase-order";

interface PoRecoverDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  po: PurchaseOrder;
  isPending: boolean;
  serverError: string | null;
  onConfirm: (input: RecoverDeliveryInput) => void;
}

/**
 * Khôi phục gửi NCC sau lần gửi thất bại (BE `/delivery-recovery`, quyền APPROVE).
 * BE `requireDeliveryRecovery`: bắt buộc lý do + xác nhận đã đối chiếu lần gửi trước; ngày giao
 * đã qua / chưa có thì phải xác nhận rõ (khôi phục không sửa được PO đã gửi).
 */
export function PoRecoverDialog({ open, onOpenChange, ...formProps }: PoRecoverDialogProps) {
  return (
    <PoDialog open={open} onOpenChange={onOpenChange}>
      <RecoverForm onCancel={() => onOpenChange(false)} {...formProps} />
    </PoDialog>
  );
}

function RecoverForm({
  po,
  isPending,
  serverError,
  onConfirm,
  onCancel,
}: Omit<PoRecoverDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const today = toLocalIsoDate(new Date().toISOString());
  const needsPastDueAck = !po.expectedDate || po.expectedDate < today;
  const [reason, setReason] = useState("");
  const [reconciled, setReconciled] = useState(false);
  const [acknowledgePastDue, setAcknowledgePastDue] = useState(false);
  const parsed = recoverDeliveryInputSchema(needsPastDueAck).safeParse({
    reason,
    reconciled,
    acknowledgePastDue,
  });

  return (
    <PoDialogForm
      title={UI_LABELS.purchaseOrder.action.recoverDelivery}
      description={`Gửi lại đơn ${po.poNumber} cho NCC sau lần gửi thất bại. Thao tác gửi ra ngoài, không thu hồi được.`}
      submitLabel="Gửi lại"
      canSubmit={parsed.success}
      isPending={isPending}
      error={serverError}
      onSubmit={() => parsed.success && onConfirm(parsed.data)}
      onCancel={onCancel}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="po-recover-reason" className="text-ink-secondary text-xs font-medium">
          Lý do gửi lại <span className="text-danger">*</span>
        </Label>
        <Textarea
          id="po-recover-reason"
          value={reason}
          maxLength={PO_REASON_MAX}
          autoFocus
          rows={3}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <label className="text-ink-primary flex items-start gap-2 text-[0.8125rem]">
        <Checkbox
          checked={reconciled}
          onCheckedChange={(v) => setReconciled(v === true)}
          className="mt-0.5"
        />
        Đã đối chiếu: NCC chưa nhận được đơn ở lần gửi trước.
      </label>
      {needsPastDueAck && (
        <label className="text-warning flex items-start gap-2 text-[0.8125rem]">
          <Checkbox
            checked={acknowledgePastDue}
            onCheckedChange={(v) => setAcknowledgePastDue(v === true)}
            className="mt-0.5"
          />
          Ngày giao dự kiến đã qua hoặc chưa có — vẫn gửi lại với ngày cũ.
        </label>
      )}
    </PoDialogForm>
  );
}
