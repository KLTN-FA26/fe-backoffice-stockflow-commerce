"use client";

import { useState } from "react";

import { ORDER_DELIVERY_MODE_LABELS, ORDER_DELIVERY_MODE_UI, ORDER_LIMITS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { ftlConflictsWithCod } from "../delivery-mode";
import { deliveryModeSchema } from "../input-schemas";

import { DeliveryModeField } from "./DeliveryModeField";
import { NoteField } from "./ReasonDialogFields";

import type { DeliveryModeValues } from "../input-schemas";
import type { Order, OrderDeliveryMode } from "../types";

interface OrderDeliveryModeDialogProps {
  order: Pick<Order, "orderNumber" | "paymentTerm" | "balancePolicy">;
  /** Hình thức hiện tại của đơn — chọn lại đúng nó thì không có gì để đổi. */
  current: OrderDeliveryMode;
  isPending: boolean;
  /** Lỗi server đã map tiếng Việt (409 FTL_NO_COD…) — hiện trong dialog, dữ liệu đã nhập giữ nguyên. */
  error: string | null;
  onSubmit: (values: DeliveryModeValues) => void;
  onClose: () => void;
}

/**
 * Đổi hình thức giao của đơn (`PUT /orders/{id}/delivery-mode`, BE PR #157): chọn hình thức khác hiện tại + ghi
 * chú tuỳ chọn (≤ 500, vào lịch sử đơn). Mở với hình thức NGƯỢC hiện tại để một thao tác là đủ.
 */
export function OrderDeliveryModeDialog({
  order,
  current,
  isPending,
  error,
  onSubmit,
  onClose,
}: OrderDeliveryModeDialogProps) {
  const L = ORDER_DELIVERY_MODE_UI.dialog;
  const [mode, setMode] = useState<OrderDeliveryMode>(
    current === "PARCEL" ? "FULL_TRUCKLOAD" : "PARCEL",
  );
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>();

  const submit = () => {
    const parsed = deliveryModeSchema.safeParse({ deliveryMode: mode, note });
    if (!parsed.success) {
      setNoteError(parsed.error.issues[0]?.message);
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <FormDialogBody
        title={L.title}
        description={`${L.description} (${order.orderNumber})`}
        submitLabel={L.submit}
        canSubmit={mode !== current}
        isPending={isPending}
        error={error}
        onSubmit={submit}
        onCancel={onClose}
      >
        <DeliveryModeField value={mode} onChange={setMode} name="delivery-mode-change" />
        {mode === current && (
          <p className="text-ink-tertiary text-xs">
            {L.sameMode} ({ORDER_DELIVERY_MODE_LABELS[current]})
          </p>
        )}
        {ftlConflictsWithCod(order, mode) && (
          <p role="status" className="text-warning text-xs">
            {ORDER_DELIVERY_MODE_UI.ftlNoCod}
          </p>
        )}
        <NoteField
          label={L.noteLabel}
          placeholder={L.notePlaceholder}
          value={note}
          max={ORDER_LIMITS.deliveryModeNoteMax}
          required={false}
          autoFocus={false}
          hint={null}
          error={noteError}
          onChange={(value) => {
            setNote(value);
            setNoteError(undefined);
          }}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
