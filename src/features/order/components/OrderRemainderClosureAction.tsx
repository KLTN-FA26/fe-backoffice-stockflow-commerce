"use client";

import { Scissors } from "lucide-react";

import {
  ORDER_ACTION_LABELS,
  ORDER_LIMITS,
  ORDER_REMAINDER_CLOSURE_LABELS,
  ORDER_REMAINDER_CLOSURE_REASONS,
} from "@/constants";
import { ActionTrigger } from "@/components/shared/ObjectActions";

import { remainderClosureSchema } from "../input-schemas";
import { useCloseOrderRemainder } from "../mutations";

import { OrderReasonDialog } from "./OrderReasonDialog";
import { RemainderFeeFields } from "./RemainderFeeFields";
import { useAgreedFeeFields } from "./useAgreedFeeFields";
import { toReasonOptions, useOrderActionDialog } from "./useOrderActionDialog";

import type { Order } from "../types";

type ActionOrder = Pick<Order, "orderId" | "orderNumber">;

export function OrderRemainderClosureAction({ order }: { order: ActionOrder }) {
  const dialog = useOrderActionDialog("remainderClosure");
  const { mutate, isPending } = useCloseOrderRemainder(dialog.hookOptions);
  // Phí đã thoả thuận (BE PR #150): tuỳ chọn; giữ trạng thái ở đây để hộp thoại gộp vào input trước khi validate
  const fee = useAgreedFeeFields();
  const labels = ORDER_ACTION_LABELS.remainderClosure;
  return (
    <>
      <ActionTrigger
        icon={Scissors}
        label={labels.button}
        danger
        onClick={() => {
          fee.reset();
          dialog.show();
        }}
      />
      {dialog.open && (
        <OrderReasonDialog
          title={labels.title}
          description={`${labels.description} (${order.orderNumber})`}
          submitLabel={labels.submit}
          reasonLabel={labels.reasonLabel}
          reasons={toReasonOptions(ORDER_REMAINDER_CLOSURE_REASONS, ORDER_REMAINDER_CLOSURE_LABELS)}
          noteLabel={labels.noteLabel}
          noteMax={ORDER_LIMITS.remainderClosureNoteMax}
          schema={remainderClosureSchema}
          extra={{
            values: fee.values,
            render: (errors) => <RemainderFeeFields fee={fee} errors={errors} />,
          }}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(values) => dialog.submit(mutate, { id: order.orderId, ...values })}
          onClose={dialog.close}
        />
      )}
    </>
  );
}
