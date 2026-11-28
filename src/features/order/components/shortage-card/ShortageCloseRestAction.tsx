"use client";

import { Button } from "@/components/ui/button";
import {
  ORDER_ACTION_LABELS,
  ORDER_REMAINDER_CLOSURE_LABELS,
  ORDER_REMAINDER_CLOSURE_REASONS,
  SHORTAGE_LABELS,
  SHORTAGE_NOTE_MAX,
} from "@/constants";

import { remainderClosureSchema } from "../../input-schemas";
import { useExecuteShortageCloseRest } from "../../shortage-card-mutations";
import { OrderReasonDialog } from "../OrderReasonDialog";
import { RemainderFeeFields } from "../RemainderFeeFields";
import { useAgreedFeeFields } from "../useAgreedFeeFields";
import { toReasonOptions, useOrderActionDialog } from "../useOrderActionDialog";

import { SHORTAGE_EXECUTE_ACTION } from "./ShortageExecuteButton";

import type { ShortageExecuteProps } from "./ShortageExecuteButton";

const L = SHORTAGE_LABELS;

/**
 * "Đóng phần còn lại", bước 2 của "giao một phần rồi đóng phần còn lại" (docs 17 §4.14 bước 58, §4.8 bước 33): chỉ khi kho
 * đã kiểm xong phần đã có. Cùng hộp thoại đóng phần còn lại của đơn (lý do, ghi chú, phí thoả thuận tuỳ chọn), nhưng chạy
 * qua thẻ để thẻ sang "Sale đã thực hiện". UI-only — Backend phải re-check (`sales-order-cancellations:UPDATE`).
 */
export function ShortageCloseRestAction({ order, card, allowed }: ShortageExecuteProps) {
  const dialog = useOrderActionDialog(SHORTAGE_EXECUTE_ACTION);
  const { mutate, isPending } = useExecuteShortageCloseRest(dialog.hookOptions);
  const fee = useAgreedFeeFields();
  const labels = ORDER_ACTION_LABELS.remainderClosure;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        disabled={!allowed}
        onClick={() => {
          fee.reset();
          dialog.show();
        }}
      >
        {L.closeRest}
      </Button>
      {!allowed && <p className="text-ink-secondary text-xs">{L.blockedNoPermission}</p>}
      {dialog.open && (
        <OrderReasonDialog
          title={L.closeRestDialog.title}
          description={`${L.closeRestDialog.description} (${order.orderNumber})`}
          submitLabel={L.closeRestDialog.submit}
          reasonLabel={labels.reasonLabel}
          reasons={toReasonOptions(ORDER_REMAINDER_CLOSURE_REASONS, ORDER_REMAINDER_CLOSURE_LABELS)}
          noteLabel={labels.noteLabel}
          noteMax={SHORTAGE_NOTE_MAX.execution}
          schema={remainderClosureSchema}
          extra={{
            values: fee.values,
            render: (errors) => <RemainderFeeFields fee={fee} errors={errors} />,
          }}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(values) =>
            dialog.submit(mutate, {
              orderId: order.orderId,
              cardId: card.cardId,
              version: card.version,
              ...values,
            })
          }
          onClose={dialog.close}
        />
      )}
    </div>
  );
}
