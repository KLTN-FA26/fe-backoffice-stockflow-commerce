"use client";

import { useState } from "react";

import { TOAST_MESSAGES } from "@/constants";
import {
  isDeliveryFailing,
  isStalePoError,
  poErrorMessage,
  useApprovePo,
  useCancelPo,
  useCloseShortPo,
  useReceiveGoodsPo,
  useRecordSupplierConfirmation,
  useRecoverPoDelivery,
  useSendPo,
} from "@/features/purchase-order";
import { toast } from "@/components/shared/Toast";

import type { ApiError } from "@/lib/api/error";
import type {
  PoActionCode,
  PoErrorContext,
  PurchaseOrder,
  ReceiveLineInput,
  RecoverDeliveryInput,
  SendPoInput,
  SupplierConfirmationInput,
} from "@/features/purchase-order";

const MSG = TOAST_MESSAGES.purchaseOrder;

/**
 * Xử lý hành động trên trang chi tiết PO. Mọi action đi qua một dialog (Duyệt / Gửi NCC cũng
 * phải xác nhận — gửi NCC là gửi email ra ngoài, không thu hồi được).
 * 409 / 400 không có field = dữ liệu trên màn đã cũ → tải lại PO để trạng thái + nút không sai.
 */
export function usePoActions(po: PurchaseOrder | null, refetchPo: () => void) {
  const approvePo = useApprovePo();
  const sendPo = useSendPo();
  const cancelPo = useCancelPo();
  const closeShortPo = useCloseShortPo();
  const receivePo = useReceiveGoodsPo();
  const recoverPo = useRecoverPoDelivery();
  const confirmPo = useRecordSupplierConfirmation();
  const [dialog, setDialog] = useState<PoActionCode | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const isMutating = [
    approvePo,
    sendPo,
    cancelPo,
    closeShortPo,
    receivePo,
    recoverPo,
    confirmPo,
  ].some((m) => m.isPending);
  const id = po?.poId ?? "";

  const close = () => {
    setDialog(null);
    setDialogError(null);
  };
  const open = (code: PoActionCode) => {
    setConflictError(null);
    setDialogError(null);
    setDialog(code);
  };

  /** `keepDialog`: lỗi hiện ngay trong dialog (form còn nguyên); ngược lại hiện ở panel + toast. */
  const onError = (context: PoErrorContext, keepDialog: boolean) => (e: ApiError) => {
    if (isStalePoError(e)) refetchPo();
    const message = poErrorMessage(e, context);
    if (keepDialog && e.status !== 409) {
      setDialogError(message);
      return;
    }
    close();
    setConflictError(message);
    toast.error(MSG.actionFailed, message);
  };
  const callbacks = (context: PoErrorContext, keepDialog: boolean) => ({
    onSuccess: close,
    onError: onError(context, keepDialog),
  });

  return {
    isMutating,
    dialog,
    dialogError,
    conflictError,
    open,
    close,
    approve: () => approvePo.mutate({ id }, callbacks("default", false)),
    cancel: (reason: string) => cancelPo.mutate({ id, reason }, callbacks("default", false)),
    closeShort: (reason: string) =>
      closeShortPo.mutate({ id, reason }, callbacks("default", false)),
    receive: (lines: ReceiveLineInput[]) =>
      receivePo.mutate({ id, lines }, callbacks("receive", true)),
    recover: (input: RecoverDeliveryInput) =>
      recoverPo.mutate({ id, input }, callbacks("default", true)),
    confirm: (input: SupplierConfirmationInput) =>
      confirmPo.mutate({ id, input }, callbacks("default", true)),
    send: (input: SendPoInput) =>
      sendPo.mutate(
        { id, input },
        {
          ...callbacks("send", true),
          // BE xếp hàng gửi (outbox): kết quả giao thật nằm ở `deliveryStatus`, không báo
          // "Đã gửi NCC" khi lần gửi đã thất bại.
          onSuccess: (updated) => {
            close();
            if (isDeliveryFailing(updated)) {
              toast.warning(MSG.deliveryFailed);
            } else {
              toast.success(MSG.sent);
            }
          },
        },
      ),
  };
}
