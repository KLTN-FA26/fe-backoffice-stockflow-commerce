"use client";

import { useState } from "react";

import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { OrderPicker } from "@/components/backoffice/OrderPicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { DrawUpForm } from "./DrawUpForm";

const D = EINVOICE_LABELS.drawUp;

function DrawUpContent({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const [picked, setPicked] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const chosenId = orderId ?? picked?.orderId ?? null;
  if (chosenId) {
    return (
      <DrawUpForm
        orderId={chosenId}
        orderNumber={orderId ? undefined : picked?.orderNumber}
        onChangeOrder={orderId ? undefined : () => setPicked(null)}
        onClose={onClose}
      />
    );
  }
  // Không có đơn sẵn (mở từ danh sách chưa lọc theo đơn): chọn đơn trước, không bao giờ gõ id (UX audit R3)
  return (
    <FormDialogBody
      title={D.title}
      description={D.orderHint}
      submitLabel={D.submit}
      canSubmit={false}
      isPending={false}
      error={null}
      onCancel={onClose}
      onSubmit={() => undefined}
    >
      <OrderPicker
        id="drawup-order"
        label={D.orderLabel}
        placeholder={D.orderPlaceholder}
        onSelect={(order) => setPicked({ orderId: order.orderId, orderNumber: order.orderNumber })}
      />
    </FormDialogBody>
  );
}

/**
 * Lập nháp thủ công cho một đơn (BE `POST /einvoices`); trả về nháp đang hiệu lực nếu đã có. Có `orderId` thì vào thẳng
 * bước chọn lô giao; `chooseOrder` (không có đơn sẵn) thì chọn đơn trước.
 */
export function DrawUpDialog({
  orderId,
  chooseOrder = false,
  onClose,
}: {
  orderId: string | null;
  chooseOrder?: boolean;
  onClose: () => void;
}) {
  return (
    <FormDialog
      open={orderId !== null || chooseOrder}
      onOpenChange={(open) => !open && onClose()}
    >
      {(orderId !== null || chooseOrder) && <DrawUpContent orderId={orderId} onClose={onClose} />}
    </FormDialog>
  );
}
