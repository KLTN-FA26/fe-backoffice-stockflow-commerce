"use client";

import { useState } from "react";

import {
  useApprovePo,
  useCancelPo,
  useCloseShortPo,
  useReceiveGoodsPo,
  useSendPo,
} from "@/features/purchase-order";
import { toast } from "@/components/shared/Toast";

import type { ApiError } from "@/lib/api/error";
import type { PoAction, PurchaseOrder } from "@/features/purchase-order";

/** User-facing message for a failed PO mutation (the factory toast is disabled for PO). */
export function describePoError(e: ApiError): string {
  if (e.status === 409)
    return `PO đã thay đổi trạng thái — đã tải lại dữ liệu mới nhất. (${e.message})`;
  if (e.status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (e.status === 404) return "Đơn đặt hàng không tồn tại hoặc đã bị xoá.";
  return e.message;
}

/** Receiving is rejected with a generic 400 (BE IllegalArgumentException) — say what to check. */
const RECEIVE_REJECTED =
  "BE từ chối số lượng nhận. Kiểm tra SL không vượt “Còn nhận được” — dữ liệu PO đã được tải lại.";

/**
 * Detail-page action handling: approve / send / cancel / closeShort / receive.
 * On 409 (someone else moved the PO) or a rejected receipt the PO is refetched, so the
 * status and the buttons shown never stay stale.
 */
export function usePoActions(po: PurchaseOrder | null, refetchPo: () => void) {
  const approvePo = useApprovePo();
  const sendPo = useSendPo();
  const cancelPo = useCancelPo();
  const closeShortPo = useCloseShortPo();
  const receivePo = useReceiveGoodsPo();
  const [pendingAction, setPendingAction] = useState<PoAction | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const isMutating =
    approvePo.isPending ||
    sendPo.isPending ||
    cancelPo.isPending ||
    closeShortPo.isPending ||
    receivePo.isPending;

  const run = (act: PoAction, reason = "") => {
    if (!po) return;
    const id = po.poId;
    const callbacks = {
      onSuccess: () => setPendingAction(null),
      onError: (e: ApiError) => {
        setPendingAction(null);
        if (e.status === 409) refetchPo();
        const message = describePoError(e);
        setConflictError(message);
        toast.error(`Không thể ${act.label.toLowerCase()}`, message);
      },
    };
    if (act.code === "approve") approvePo.mutate({ id }, callbacks);
    else if (act.code === "send") sendPo.mutate({ id }, callbacks);
    else if (act.code === "cancel") cancelPo.mutate({ id, reason }, callbacks);
    else if (act.code === "closeShort") closeShortPo.mutate({ id, reason }, callbacks);
  };

  const onAction = (act: PoAction) => {
    setConflictError(null);
    if (act.code === "receive") {
      setReceiveError(null);
      setReceiveOpen(true);
    } else if (act.requiresReason) {
      setPendingAction(act);
    } else {
      run(act);
    }
  };

  const confirmReceive = (lines: { lineId: string; quantity: number }[]) => {
    if (!po) return;
    setReceiveError(null);
    receivePo.mutate(
      { id: po.poId, lines },
      {
        onSuccess: () => setReceiveOpen(false),
        onError: (e: ApiError) => {
          if (e.status === 400 || e.status === 409) refetchPo();
          if (e.status === 409) {
            setReceiveOpen(false);
            setConflictError(describePoError(e));
            return;
          }
          setReceiveError(e.status === 400 ? RECEIVE_REJECTED : describePoError(e));
        },
      },
    );
  };

  return {
    isMutating,
    isReceiving: receivePo.isPending,
    pendingAction,
    closeReasonDialog: () => setPendingAction(null),
    confirmReason: (reason: string) => pendingAction && run(pendingAction, reason),
    receiveOpen,
    setReceiveOpen,
    receiveError,
    conflictError,
    onAction,
    confirmReceive,
  };
}
