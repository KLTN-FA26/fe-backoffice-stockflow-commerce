"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { RECEIPT_STATUS, UI_LABELS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { usePermissionChecker } from "@/lib/auth";
import { allowedReceiptActions, isReceiptTerminal } from "@/features/receipt/lifecycle";
import { useCancelGoodsReceipt, useConfirmGoodsReceipt } from "@/features/receipt/mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { ReceiptActionCode } from "@/features/receipt/lifecycle";
import type { GoodsReceipt } from "@/features/receipt/types";

const NO_ACTIONS = UI_LABELS.receipt.noActions;

/** Câu thay cho nút khi phiếu không còn thao tác cấp phiếu nào với người dùng này. */
function noActionText(status: GoodsReceipt["status"]): string {
  if (isReceiptTerminal(status)) return `${STATUS_LABEL_VI[status]} — không còn thao tác.`;
  if (status === RECEIPT_STATUS.IN_QC) return NO_ACTIONS.inQc;
  if (status === RECEIPT_STATUS.IN_PUTAWAY) return NO_ACTIONS.inPutaway;
  return NO_ACTIONS.viewOnly;
}

const BUTTON_BASE = "w-full rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium";

/**
 * Card thao tác cột phải (cùng bố cục `ActionCard` của supplier): trạng thái + nút
 * "Xác nhận nhập kho" / "Huỷ phiếu" theo `allowedReceiptActions` (không rải if/else).
 * Mọi thao tác qua ConfirmDialog; đang chạy → khoá nút, chặn bấm hai lần.
 */
export function ReceiptActions({
  receipt,
  hasUnsavedCount,
}: {
  receipt: GoodsReceipt;
  /** Form kiểm đếm còn thay đổi chưa lưu → khoá xác nhận (BE xác nhận số đã lưu). */
  hasUnsavedCount: boolean;
}) {
  const can = usePermissionChecker();
  const confirm = useConfirmGoodsReceipt();
  const cancel = useCancelGoodsReceipt();
  const [dialog, setDialog] = useState<ReceiptActionCode | null>(null);
  const actions = allowedReceiptActions(
    { status: receipt.status, lineCount: receipt.lines.length },
    can,
  ).filter(({ action }) => action.code !== "saveLines");
  const pending = confirm.isPending || cancel.isPending;
  // Lỗi dữ liệu cũ đã được mutation tự tải lại (withStaleRefetch) — ở đây chỉ đóng dialog
  const callbacks = { onSuccess: () => setDialog(null), onError: () => setDialog(null) };

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-4 flex justify-center">
        <StatusDot domain="receipt" status={receipt.status} size="md" withIcon />
      </div>
      <div className="space-y-2">
        {actions.map(({ action, disabledReason }) => {
          const reason =
            action.code === "confirm" && hasUnsavedCount
              ? "Lưu kiểm đếm trước khi xác nhận"
              : disabledReason;
          const Icon = action.destructive ? XCircle : CheckCircle2;
          return (
            <div key={action.code}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !!reason}
                onClick={() => setDialog(action.code)}
                className={
                  action.destructive
                    ? `border-danger text-danger hover:bg-danger/10 hover:text-danger bg-transparent ${BUTTON_BASE}`
                    : `border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse ${BUTTON_BASE}`
                }
              >
                <Icon className="size-3.5" /> {action.label}
              </Button>
              {reason && <p className="text-ink-tertiary mt-1 text-center text-xs">{reason}</p>}
            </div>
          );
        })}
        {actions.length === 0 && (
          <p className="text-ink-tertiary text-center text-xs">{noActionText(receipt.status)}</p>
        )}
      </div>
      <ConfirmDialog
        open={dialog === "confirm"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Xác nhận nhập kho"
        description={`Chốt số của ${receipt.number}: hàng thành tồn Inbound ở khu nhận hàng, đơn đặt hàng cập nhật SL đã nhận. Sau khi xác nhận phiếu chỉ còn xem, sai sót phải điều chỉnh tồn (BR-05).`}
        confirmLabel="Xác nhận nhập kho"
        variant="default"
        loading={confirm.isPending}
        closeOnConfirm={false}
        onConfirm={() => confirm.mutate(receipt.id, callbacks)}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Huỷ phiếu nhận"
        description={`Huỷ ${receipt.number}? Chỉ phiếu nháp mới huỷ được; không thể khôi phục.`}
        confirmLabel="Huỷ phiếu"
        variant="danger"
        loading={cancel.isPending}
        closeOnConfirm={false}
        onConfirm={() => cancel.mutate(receipt.id, callbacks)}
      />
    </section>
  );
}
