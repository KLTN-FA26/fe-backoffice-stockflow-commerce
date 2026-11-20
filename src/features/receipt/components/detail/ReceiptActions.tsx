"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { RECEIPT_STATUS, UI_LABELS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { usePermissionChecker } from "@/lib/auth";
import { allowedReceiptActions, isReceiptTerminal } from "@/features/receipt/lifecycle";
import { useCancelGoodsReceipt, useConfirmGoodsReceipt } from "@/features/receipt/mutations";
import { isLegacyPurchaseReceipt } from "@/features/receipt/selectors";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { ReceiptActionCode } from "@/features/receipt/lifecycle";
import type { GoodsReceipt } from "@/features/receipt/types";

const LABEL = UI_LABELS.receipt;

/** Câu thay cho nút khi phiếu không còn thao tác cấp phiếu nào với người dùng này. */
function noActionText(receipt: GoodsReceipt): string {
  if (isReceiptTerminal(receipt.status))
    return `${STATUS_LABEL_VI[receipt.status]} — không còn thao tác.`;
  if (receipt.status === RECEIPT_STATUS.IN_PUTAWAY) return LABEL.noActions.inPutaway;
  if (isLegacyPurchaseReceipt(receipt)) return LABEL.legacyPurchase.confirmNote;
  return LABEL.noActions.viewOnly;
}

const BUTTON_BASE =
  "h-(--action-h) w-full rounded-(--action-radius) border px-3 text-[0.8125rem] font-medium";

/**
 * Card thao tác cột phải: trạng thái + nút "Xác nhận nhập kho" / "Huỷ phiếu" theo `allowedReceiptActions`
 * (không rải if/else). Mọi thao tác qua ConfirmDialog; đang chạy → khoá nút, chặn bấm hai lần.
 */
export function ReceiptActions({
  receipt,
  countDirty = false,
}: {
  receipt: GoodsReceipt;
  /** Form kiểm đếm còn thay đổi chưa lưu → khoá "Xác nhận nhập kho". */
  countDirty?: boolean;
}) {
  const can = usePermissionChecker();
  const confirm = useConfirmGoodsReceipt();
  const cancel = useCancelGoodsReceipt();
  const [dialog, setDialog] = useState<ReceiptActionCode | null>(null);
  const actions = allowedReceiptActions(
    {
      status: receipt.status,
      lineCount: receipt.lines.length,
      receiptType: receipt.receiptType,
      countDirty,
    },
    can,
  );
  const pending = confirm.isPending || cancel.isPending;
  // Lỗi dữ liệu cũ đã được mutation tự tải lại (withStaleRefetch) — ở đây chỉ đóng dialog
  const callbacks = { onSuccess: () => setDialog(null), onError: () => setDialog(null) };

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
      <div className="mb-4 flex justify-center">
        <StatusDot domain="receipt" status={receipt.status} size="md" withIcon />
      </div>
      <div className="space-y-2">
        {actions.map(({ action, disabledReason }) => {
          const Icon = action.destructive ? XCircle : CheckCircle2;
          return (
            <div key={action.code}>
              <Button
                type="button"
                // Nút chính dùng variant default: `outline` có `dark:bg-input/30` đè `bg-brand` ở dark mode → chữ
                // ink-inverse nằm trên nền tối mờ, gần như vô hình
                variant={action.destructive ? "outline" : "default"}
                size="sm"
                disabled={pending || !!disabledReason}
                onClick={() => setDialog(action.code)}
                className={
                  action.destructive
                    ? `border-danger text-danger hover:bg-danger/10 hover:text-danger bg-transparent ${BUTTON_BASE}`
                    : `border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse ${BUTTON_BASE}`
                }
              >
                <Icon className="size-3.5" /> {action.label}
              </Button>
              {disabledReason && (
                <p className="text-ink-tertiary mt-1 text-center text-xs">{disabledReason}</p>
              )}
            </div>
          );
        })}
        {actions.length === 0 && (
          <p className="text-ink-tertiary text-center text-xs">{noActionText(receipt)}</p>
        )}
      </div>
      <ConfirmDialog
        open={dialog === "confirm"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={LABEL.action.confirm}
        description={LABEL.confirmDialog.confirmDescription(receipt.number)}
        confirmLabel={LABEL.action.confirm}
        variant="default"
        loading={confirm.isPending}
        closeOnConfirm={false}
        onConfirm={() => confirm.mutate(receipt.id, callbacks)}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={LABEL.confirmDialog.cancelTitle}
        description={LABEL.confirmDialog.cancelDescription(receipt.number)}
        confirmLabel={LABEL.action.cancel}
        variant="danger"
        loading={cancel.isPending}
        closeOnConfirm={false}
        onConfirm={() => cancel.mutate(receipt.id, callbacks)}
      />
    </section>
  );
}
