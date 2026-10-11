"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  ORDER_CANCELLATION_REASON_CODES,
  ORDER_CANCELLATION_REASON_LABELS,
  ORDER_LIMITS,
} from "@/constants";
import { FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { adminCancelOrderSchema } from "../action-schemas";
import { adminCancelErrorView } from "../errors";
import { useAdminCancelOrder } from "../mutations";
import { orderKeys } from "../queries";
import { cancelConsequence } from "../selectors";

import { OrderRefusalAlert } from "./OrderRefusalAlert";
import { RetainedPercentField } from "./RetainedPercentField";

import type { OrderCancellationReasonCode } from "@/constants";
import type { OrderErrorView } from "../errors";
import type { Order } from "../types";

export type CancelOrder = Pick<
  Order,
  "orderId" | "orderNumber" | "status" | "paidAmount" | "currency"
>;

/** Lỗi cho thấy dữ liệu trên màn đã cũ (đơn đã đổi trạng thái / không còn trong phạm vi). */
const STALE_ERROR_CODES: readonly string[] = ["ORDER_NOT_CANCELLABLE", "CONFLICT", "NOT_FOUND"];
const LABEL = "text-ink-secondary text-xs font-medium";

function isReasonCode(value: string): value is OrderCancellationReasonCode {
  return (ORDER_CANCELLATION_REASON_CODES as readonly string[]).includes(value);
}

/** Form huỷ đơn admin (mã lý do, ghi chú, % giữ lại) — trong `FormDialog` của OrderCancelAction. */
export function CancelForm({ order, onClose }: { order: CancelOrder; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reasonCode, setReasonCode] = useState<OrderCancellationReasonCode | "">("");
  const [note, setNote] = useState("");
  const [retained, setRetained] = useState("");
  const [refusal, setRefusal] = useState<OrderErrorView | null>(null);
  const { mutate: adminCancel, isPending } = useAdminCancelOrder();
  const paid = order.paidAmount ?? 0;
  const parsed = adminCancelOrderSchema.safeParse({
    reasonCode: reasonCode || undefined,
    note: note.trim() || undefined,
    retainedPercent: retained.trim() === "" ? undefined : Number(retained),
  });
  const fieldError = (field: string) =>
    parsed.error?.issues.find((issue) => issue.path[0] === field)?.message;
  const consequence = cancelConsequence(order.status);

  const submit = () => {
    if (!parsed.success) return;
    setRefusal(null);
    adminCancel(
      { id: order.orderId, ...parsed.data },
      {
        onSuccess: onClose,
        onError: (error) => {
          const view = adminCancelErrorView(error);
          if (STALE_ERROR_CODES.includes(error.code)) {
            onClose();
            toast.error(view.title, view.detail);
            // Cả list lẫn detail đều đang giữ trạng thái cũ → làm mới toàn bộ dữ liệu đơn
            void queryClient.invalidateQueries({ queryKey: orderKeys.all });
            return;
          }
          setRefusal(view);
        },
      },
    );
  };

  return (
    <FormDialogBody
      title="Huỷ đơn hàng"
      description={`Huỷ đơn ${order.orderNumber}? Hành động này không thể hoàn tác.`}
      submitLabel="Huỷ đơn"
      danger
      canSubmit={parsed.success}
      isPending={isPending}
      error={null}
      onSubmit={submit}
      onCancel={onClose}
    >
      {consequence && <p className="text-warning text-xs">{consequence}</p>}
      <div className="grid gap-1.5">
        <Label htmlFor="cancel-reason-code" className={LABEL}>
          Lý do huỷ <span className="text-danger">*</span>
        </Label>
        <Select value={reasonCode} onValueChange={(v) => setReasonCode(isReasonCode(v) ? v : "")}>
          <SelectTrigger id="cancel-reason-code" autoFocus className="w-full">
            <SelectValue placeholder="Chọn lý do huỷ" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_CANCELLATION_REASON_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                {ORDER_CANCELLATION_REASON_LABELS[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cancel-note" className={LABEL}>
          Ghi chú {reasonCode === "OTHER" && <span className="text-danger">*</span>}
        </Label>
        <Textarea
          id="cancel-note"
          value={note}
          maxLength={ORDER_LIMITS.cancelNoteMax}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
        />
        {reasonCode === "OTHER" && fieldError("note") && (
          <p className="text-danger text-xs">{fieldError("note")}</p>
        )}
      </div>
      {/* Chỉ có ý nghĩa khi đã thu tiền: phần giữ lại cho công việc đã làm (docs 17 §4.5) */}
      {paid > 0 && (
        <RetainedPercentField
          value={retained}
          paidAmount={paid}
          currency={order.currency}
          error={fieldError("retainedPercent")}
          onChange={setRetained}
        />
      )}
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}
