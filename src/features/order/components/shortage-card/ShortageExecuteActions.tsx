"use client";

import { SHORTAGE_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";

import {
  useExecuteShortageCancel,
  useExecuteShortageReduce,
  useExecuteShortageShipPart,
} from "../../shortage-card-mutations";
import { useCancellationFee } from "../cancellation/useCancellationFee";
import { useOrderActionDialog } from "../useOrderActionDialog";

import { ShortageConfirmDialog } from "./ShortageConfirmDialog";
import { ExecuteButton, SHORTAGE_EXECUTE_ACTION } from "./ShortageExecuteButton";

import type { ShortageFeeValues } from "./ShortageConfirmDialog";
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

/** Hộp thoại "Huỷ đơn" — mount mỗi lần mở nên ô phí luôn sạch. */
function ShortageCancelDialog({
  orderNumber,
  feePossible,
  isPending,
  error,
  onSubmit,
  onClose,
}: {
  orderNumber: string;
  feePossible: boolean;
  isPending: boolean;
  error: string | null;
  onSubmit: (note: string, fee: ShortageFeeValues) => void;
  onClose: () => void;
}) {
  const C = SHORTAGE_LABELS.confirm;
  const fee = useCancellationFee();
  return (
    <ShortageConfirmDialog
      title={C.cancelTitle}
      lines={C.cancelLines}
      note={{ label: C.cancelNoteLabel, prefill: C.cancelNotePrefill(orderNumber) }}
      fee={feePossible ? fee : undefined}
      danger
      isPending={isPending}
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

/**
 * "Huỷ đơn": lý do cố định hết hàng (BE `OUT_OF_STOCK`), ghi chú điền sẵn. Khi thẻ báo `feePossible` (đã có Đơn sản xuất In
 * Production, 17 §4.8 bước 30) Sale có thể giữ phí (% hoặc số tiền thoả thuận) và PHẢI chọn "Bên chịu phí" (D46/D50); không
 * thì không có ô phí (BE từ chối phí khi chưa in).
 */
export function ShortageCancelAction({ order, card, allowed }: ShortageExecuteProps) {
  const dialog = useOrderActionDialog(SHORTAGE_EXECUTE_ACTION);
  const { mutate, isPending } = useExecuteShortageCancel(dialog.hookOptions);
  const feePossible = card.options.find((o) => o.option === "CANCEL_ORDER")?.feePossible === true;
  return (
    <>
      <ExecuteButton option="CANCEL_ORDER" allowed={allowed} onClick={dialog.show} />
      {dialog.open && (
        <ShortageCancelDialog
          orderNumber={order.orderNumber}
          feePossible={feePossible}
          isPending={isPending}
          error={dialog.error}
          onClose={dialog.close}
          onSubmit={(note, fee) =>
            dialog.submit(mutate, {
              orderId: order.orderId,
              cardId: card.cardId,
              version: card.version,
              note,
              ...fee,
            })
          }
        />
      )}
    </>
  );
}
