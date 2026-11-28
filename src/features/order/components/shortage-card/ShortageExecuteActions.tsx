"use client";

import { SHORTAGE_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";

import {
  useExecuteShortageCancel,
  useExecuteShortageReduce,
  useExecuteShortageShipPart,
} from "../../shortage-card-mutations";
import { useOrderActionDialog } from "../useOrderActionDialog";

import { ShortageConfirmDialog } from "./ShortageConfirmDialog";
import { ExecuteButton, SHORTAGE_EXECUTE_ACTION } from "./ShortageExecuteButton";

import type { ShortageExecuteProps } from "./ShortageExecuteButton";

/** "Giảm số thùng" (BE-3, D45): bỏ số thùng thiếu của đợt, số phải thu giảm; không cần phụ lục hợp đồng. */
export function ShortageReduceAction({ order, card, allowed }: ShortageExecuteProps) {
  const dialog = useOrderActionDialog(SHORTAGE_EXECUTE_ACTION);
  const { mutate, isPending } = useExecuteShortageReduce(dialog.hookOptions);
  const amount = card.options.find((o) => o.option === "REDUCE_CARTONS")?.amountReduced;
  const C = SHORTAGE_LABELS.confirm;
  return (
    <>
      <ExecuteButton option="REDUCE_CARTONS" allowed={allowed} onClick={dialog.show} />
      {dialog.open && (
        <ShortageConfirmDialog
          title={C.reduceTitle}
          lines={[
            C.reduceBody(
              card.missingCartons,
              card.batch.seq,
              amount != null ? formatMoney(amount, "VND") : "—",
            ),
            C.reduceNoContract,
          ]}
          isPending={isPending}
          error={dialog.error}
          onClose={dialog.close}
          onSubmit={() =>
            dialog.submit(mutate, {
              orderId: order.orderId,
              cardId: card.cardId,
              version: card.version,
            })
          }
        />
      )}
    </>
  );
}

/** "Giao một phần rồi đóng phần còn lại", bước 1: cho phép giao một phần, huỷ dòng thiếu, gỡ treo. */
export function ShortageShipPartAction({ order, card, allowed }: ShortageExecuteProps) {
  const dialog = useOrderActionDialog(SHORTAGE_EXECUTE_ACTION);
  const { mutate, isPending } = useExecuteShortageShipPart(dialog.hookOptions);
  const C = SHORTAGE_LABELS.confirm;
  return (
    <>
      <ExecuteButton option="SHIP_PART_CLOSE_REST" allowed={allowed} onClick={dialog.show} />
      {dialog.open && (
        <ShortageConfirmDialog
          title={C.shipPartTitle}
          lines={C.shipPartLines}
          isPending={isPending}
          error={dialog.error}
          onClose={dialog.close}
          onSubmit={() =>
            dialog.submit(mutate, {
              orderId: order.orderId,
              cardId: card.cardId,
              version: card.version,
            })
          }
        />
      )}
    </>
  );
}

/** "Huỷ đơn": lý do cố định hết hàng (BE `OUT_OF_STOCK`), ghi chú điền sẵn. Phí huỷ + bên chịu phí: FE-2. */
export function ShortageCancelAction({ order, card, allowed }: ShortageExecuteProps) {
  const dialog = useOrderActionDialog(SHORTAGE_EXECUTE_ACTION);
  const { mutate, isPending } = useExecuteShortageCancel(dialog.hookOptions);
  const C = SHORTAGE_LABELS.confirm;
  return (
    <>
      <ExecuteButton option="CANCEL_ORDER" allowed={allowed} onClick={dialog.show} />
      {dialog.open && (
        <ShortageConfirmDialog
          title={C.cancelTitle}
          lines={C.cancelLines}
          note={{ label: C.cancelNoteLabel, prefill: C.cancelNotePrefill(order.orderNumber) }}
          danger
          isPending={isPending}
          error={dialog.error}
          onClose={dialog.close}
          onSubmit={(note) =>
            dialog.submit(mutate, {
              orderId: order.orderId,
              cardId: card.cardId,
              version: card.version,
              note,
            })
          }
        />
      )}
    </>
  );
}
