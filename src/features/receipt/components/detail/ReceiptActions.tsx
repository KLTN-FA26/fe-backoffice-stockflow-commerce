"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import {
  RECEIPT_LIMITS,
  RECEIPT_STATUS,
  RECEIPT_WARNING_OVER_TOLERANCE,
  UI_LABELS,
} from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { usePermissionChecker } from "@/lib/auth";
import { receiptErrorMessage } from "@/features/receipt/errors";
import { allowedReceiptActions, isReceiptTerminal } from "@/features/receipt/lifecycle";
import {
  useApproveGoodsReceipt,
  useCancelGoodsReceipt,
  useConfirmGoodsReceipt,
  useRejectBlindReceipt,
  useRejectReceiptExcess,
} from "@/features/receipt/mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { ReceiptActionCode } from "@/features/receipt/lifecycle";
import type { GoodsReceipt } from "@/features/receipt/types";

const NO_ACTIONS = UI_LABELS.receipt.noActions;
const OVER = UI_LABELS.receipt.overTolerance;
const BLIND = UI_LABELS.receipt.blind;

/** Câu thay cho nút khi phiếu không còn thao tác cấp phiếu nào với người dùng này. */
function noActionText(status: GoodsReceipt["status"]): string {
  if (isReceiptTerminal(status)) return `${STATUS_LABEL_VI[status]} — không còn thao tác.`;
  if (status === RECEIPT_STATUS.PENDING_APPROVAL) return NO_ACTIONS.pendingApproval;
  if (status === RECEIPT_STATUS.IN_QC) return NO_ACTIONS.inQc;
  if (status === RECEIPT_STATUS.IN_PUTAWAY) return NO_ACTIONS.inPutaway;
  return NO_ACTIONS.viewOnly;
}

/** Nhãn nút: xác nhận → "Gửi Quản lý kho duyệt" khi chỉ chờ duyệt; duyệt phiếu không có PO có nhãn riêng. */
function actionLabel(
  code: ReceiptActionCode,
  label: string,
  sendsForApproval: boolean,
  withoutPo: boolean,
): string {
  if (code === "confirm" && sendsForApproval) return OVER.sendForApproval;
  if (code === "approve" && withoutPo) return UI_LABELS.receipt.action.approveBlind;
  return label;
}

const BUTTON_BASE =
  "h-(--action-h) w-full rounded-(--action-radius) border px-3 text-[0.8125rem] font-medium";

/**
 * Card thao tác cột phải (cùng bố cục `ActionCard` của supplier): trạng thái + nút
 * "Xác nhận nhập kho" / "Huỷ phiếu" theo `allowedReceiptActions` (không rải if/else). Phiếu vượt
 * dung sai (`Pending Approval`, BR-RCP-001): người có quyền duyệt thấy "Duyệt nhận vượt dung sai" /
 * "Từ chối phần vượt", cả hai bắt buộc lý do. Mọi thao tác qua ConfirmDialog; đang chạy → khoá nút,
 * chặn bấm hai lần.
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
  const approve = useApproveGoodsReceipt();
  const rejectExcess = useRejectReceiptExcess();
  const rejectBlind = useRejectBlindReceipt();
  const [dialog, setDialog] = useState<ReceiptActionCode | null>(null);
  // Lỗi của lần duyệt / từ chối vừa rồi — hiện trong dialog (ô lý do giữ nguyên để thử lại)
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const actions = allowedReceiptActions(
    {
      status: receipt.status,
      lineCount: receipt.lines.length,
      withoutPo: receipt.withoutPurchaseOrder,
    },
    can,
  ).filter(({ action }) => action.code !== "saveLines");
  const pending =
    confirm.isPending ||
    cancel.isPending ||
    approve.isPending ||
    rejectExcess.isPending ||
    rejectBlind.isPending;
  const withoutPo = receipt.withoutPurchaseOrder;
  const overTolerance = receipt.warnings.includes(RECEIPT_WARNING_OVER_TOLERANCE);
  // Xác nhận không ghi nhận ngay: phiếu vượt dung sai (BR-RCP-001) hoặc phiếu không có PO (BR-RCP-002) chờ duyệt
  const sendsForApproval = overTolerance || withoutPo;
  // Lỗi dữ liệu cũ đã được mutation tự tải lại (withStaleRefetch) — ở đây chỉ đóng dialog
  const callbacks = { onSuccess: () => setDialog(null), onError: () => setDialog(null) };
  const closeDecision = (open: boolean) => {
    if (open) return;
    setDialog(null);
    setDecisionError(null);
  };
  const decisionCallbacks = {
    onSuccess: () => closeDecision(false),
    // `withStaleRefetch` đã tải lại phiếu; lỗi nghiệp vụ (4 mắt, hết chỗ) ở lại dialog để người duyệt đọc
    onError: (error: unknown) => setDecisionError(receiptErrorMessage(error)),
  };

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
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
                onClick={() => {
                  setDecisionError(null);
                  setDialog(action.code);
                }}
                className={
                  action.destructive
                    ? `border-danger text-danger hover:bg-danger/10 hover:text-danger bg-transparent ${BUTTON_BASE}`
                    : `border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse ${BUTTON_BASE}`
                }
              >
                <Icon className="size-3.5" />{" "}
                {actionLabel(action.code, action.label, sendsForApproval, withoutPo)}
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
        description={
          sendsForApproval
            ? `Chốt số của ${receipt.number}. ${withoutPo ? BLIND.confirmNote : OVER.confirmNote}`
            : `Chốt số của ${receipt.number}: hàng thành tồn Inbound ở khu nhận hàng, đơn đặt hàng cập nhật SL đã nhận. Sau khi xác nhận phiếu chỉ còn xem, sai sót phải điều chỉnh tồn (BR-05).`
        }
        confirmLabel={sendsForApproval ? OVER.sendForApproval : "Xác nhận nhập kho"}
        variant="default"
        loading={confirm.isPending}
        closeOnConfirm={false}
        onConfirm={() => confirm.mutate(receipt.id, callbacks)}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Huỷ phiếu nhận"
        description={
          receipt.status === RECEIPT_STATUS.PENDING_APPROVAL
            ? `${receipt.number}: ${OVER.cancelPendingDescription}`
            : `Huỷ ${receipt.number}? Chỉ phiếu nháp mới huỷ được; không thể khôi phục.`
        }
        confirmLabel="Huỷ phiếu"
        variant="danger"
        loading={cancel.isPending}
        closeOnConfirm={false}
        onConfirm={() => cancel.mutate(receipt.id, callbacks)}
      />
      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={closeDecision}
        title={withoutPo ? UI_LABELS.receipt.action.approveBlind : OVER.approveTitle}
        description={`${receipt.number}: ${withoutPo ? BLIND.approveDescription : OVER.approveDescription}`}
        confirmLabel={
          withoutPo ? UI_LABELS.receipt.action.approveBlind : UI_LABELS.receipt.action.approve
        }
        variant="default"
        requireReason
        reasonLabel={OVER.reasonLabel}
        reasonMaxLength={RECEIPT_LIMITS.approvalReasonMax}
        loading={approve.isPending}
        closeOnConfirm={false}
        error={decisionError}
        onConfirm={(reason) =>
          approve.mutate(
            { receiptId: receipt.id, reason: (reason ?? "").trim() },
            decisionCallbacks,
          )
        }
      />
      <ConfirmDialog
        open={dialog === "rejectBlind"}
        onOpenChange={closeDecision}
        title={BLIND.rejectTitle}
        description={`${receipt.number}: ${BLIND.rejectDescription}`}
        confirmLabel={UI_LABELS.receipt.action.rejectBlind}
        variant="danger"
        requireReason
        reasonLabel={OVER.reasonLabel}
        reasonMaxLength={RECEIPT_LIMITS.approvalReasonMax}
        loading={rejectBlind.isPending}
        closeOnConfirm={false}
        error={decisionError}
        onConfirm={(reason) =>
          rejectBlind.mutate(
            { receiptId: receipt.id, reason: (reason ?? "").trim() },
            decisionCallbacks,
          )
        }
      />
      <ConfirmDialog
        open={dialog === "rejectExcess"}
        onOpenChange={closeDecision}
        title={OVER.rejectTitle}
        description={`${receipt.number}: ${OVER.rejectDescription}`}
        confirmLabel={UI_LABELS.receipt.action.rejectExcess}
        variant="danger"
        requireReason
        reasonLabel={OVER.reasonLabel}
        reasonMaxLength={RECEIPT_LIMITS.approvalReasonMax}
        loading={rejectExcess.isPending}
        closeOnConfirm={false}
        error={decisionError}
        onConfirm={(reason) =>
          rejectExcess.mutate(
            { receiptId: receipt.id, reason: (reason ?? "").trim() },
            decisionCallbacks,
          )
        }
      />
    </section>
  );
}
