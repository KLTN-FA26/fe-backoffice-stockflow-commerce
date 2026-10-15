"use client";

import { TRANSFER_LIMITS, UI_LABELS } from "@/constants";
import { isStaleTransferError } from "@/features/transfer/errors";
import {
  useApproveTransferOrder,
  useCancelTransferOrder,
  useCancelTransferPicking,
  useRejectTransferOrder,
  useStartTransferPicking,
  useSubmitTransferOrder,
} from "@/features/transfer/mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { TransferActionCode } from "@/features/transfer/lifecycle";
import type { TransferOrder } from "@/features/transfer/types";

const A = UI_LABELS.transfer.action;
const C = UI_LABELS.transfer.confirm;

/**
 * Dialog xác nhận cho các thao tác chuyển trạng thái (trừ xuất kho có form riêng). Từ chối / huỷ bắt
 * buộc lý do (BE ReasonRequest). Lỗi → mutation toast câu tiếng Việt và tự tải lại lệnh nếu cũ.
 */
export function TransferConfirmDialogs({
  transfer,
  dialog,
  onClose,
}: {
  transfer: TransferOrder;
  dialog: TransferActionCode | null;
  onClose: () => void;
}) {
  const submit = useSubmitTransferOrder();
  const approve = useApproveTransferOrder();
  const reject = useRejectTransferOrder();
  const startPicking = useStartTransferPicking();
  const cancelPicking = useCancelTransferPicking();
  const cancel = useCancelTransferOrder();
  const id = transfer.transferId;
  // Lỗi thường (mạng, 5xx…) → giữ dialog + lý do đã gõ để bấm lại (toast đã báo lỗi). Chỉ đóng khi
  // lệnh đã đổi ở nơi khác — dữ liệu đã được tải lại, nút trên màn có thể đã khác.
  const callbacks = {
    onSuccess: onClose,
    onError: (error: unknown) => {
      if (isStaleTransferError(error)) onClose();
    },
  };
  const common = {
    onOpenChange: (open: boolean) => !open && onClose(),
    closeOnConfirm: false,
  };

  return (
    <>
      <ConfirmDialog
        {...common}
        open={dialog === "submit"}
        variant="default"
        title={A.submit}
        description={C.submit(transfer.number)}
        confirmLabel={A.submit}
        loading={submit.isPending}
        onConfirm={() => submit.mutate(id, callbacks)}
      />
      <ConfirmDialog
        {...common}
        open={dialog === "approve"}
        variant="default"
        title={A.approve}
        description={C.approve(transfer.number)}
        confirmLabel={A.approve}
        loading={approve.isPending}
        onConfirm={() => approve.mutate(id, callbacks)}
      />
      <ConfirmDialog
        {...common}
        open={dialog === "reject"}
        title={A.reject}
        description={C.reject(transfer.number)}
        confirmLabel={A.reject}
        variant="danger"
        requireReason
        reasonLabel={C.rejectReason}
        reasonMaxLength={TRANSFER_LIMITS.reasonMax}
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate({ transferId: id, reason: reason ?? "" }, callbacks)}
      />
      <ConfirmDialog
        {...common}
        open={dialog === "startPicking"}
        variant="default"
        title={A.startPicking}
        description={C.startPicking(transfer.number)}
        confirmLabel={A.startPicking}
        loading={startPicking.isPending}
        onConfirm={() => startPicking.mutate(id, callbacks)}
      />
      <ConfirmDialog
        {...common}
        open={dialog === "cancelPicking"}
        variant="default"
        title={A.cancelPicking}
        description={C.cancelPicking(transfer.number)}
        confirmLabel={A.cancelPicking}
        loading={cancelPicking.isPending}
        onConfirm={() => cancelPicking.mutate(id, callbacks)}
      />
      <ConfirmDialog
        {...common}
        open={dialog === "cancel"}
        title={A.cancel}
        description={C.cancel(transfer.number)}
        confirmLabel={A.cancel}
        variant="danger"
        requireReason
        reasonLabel={C.cancelReason}
        reasonMaxLength={TRANSFER_LIMITS.reasonMax}
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate({ transferId: id, reason: reason ?? "" }, callbacks)}
      />
    </>
  );
}
