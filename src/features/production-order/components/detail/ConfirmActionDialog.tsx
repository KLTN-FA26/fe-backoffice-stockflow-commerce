"use client";

import { useState } from "react";

import { PRODUCTION_LABELS, PRODUCTION_LIMITS } from "@/constants";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import {
  useApproveProductionOrder,
  useCancelProductionOrder,
  useCloseProductionOrder,
  useResendDispatch,
  useReturnProductionOrder,
  useSubmitProductionOrder,
} from "@/features/production-order/mutations";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { ProductionOrder } from "@/features/production-order/types";

const D = PRODUCTION_LABELS.dialogs;
const A = PRODUCTION_LABELS.actions;

export type ConfirmActionKind = "submit" | "approve" | "return" | "cancel" | "close" | "resend";

const COPY: Record<
  ConfirmActionKind,
  { title: string; description: string; confirm: string; reason?: string; danger?: boolean }
> = {
  submit: { title: D.submitTitle, description: D.submitDescription, confirm: A.submit },
  approve: { title: D.approveTitle, description: D.approveDescription, confirm: A.approve },
  // BR-23 (docs 17 §6): trả lại bắt buộc lý do
  return: {
    title: D.returnTitle,
    description: D.returnDescription,
    confirm: A.return,
    reason: D.returnReason,
    danger: true,
  },
  // BR-06 (docs 17 §6): huỷ / đóng bắt buộc lý do
  cancel: {
    title: D.cancelTitle,
    description: D.cancelDescription,
    confirm: A.cancel,
    reason: D.cancelReason,
    danger: true,
  },
  close: {
    title: D.closeTitle,
    description: D.closeDescription,
    confirm: A.close,
    reason: D.closeReason,
    danger: true,
  },
  resend: {
    title: PRODUCTION_LABELS.dispatch.resendConfirm,
    description: PRODUCTION_LABELS.dispatch.resendDescription,
    confirm: PRODUCTION_LABELS.dispatch.resend,
  },
};

/**
 * Xác nhận thao tác một bước trên Đơn sản xuất: gửi duyệt, duyệt, trả lại, huỷ, đóng, gửi lại mail. Lý do (≤ 500) bắt
 * buộc với trả lại / huỷ / đóng. Dialog giữ nguyên tới khi thành công; lỗi hiện trong dialog.
 */
export function ConfirmActionDialog({
  kind,
  order,
  onClose,
}: {
  kind: ConfirmActionKind;
  order: ProductionOrder;
  onClose: () => void;
}) {
  const hooks = {
    submit: useSubmitProductionOrder(),
    approve: useApproveProductionOrder(),
    return: useReturnProductionOrder(),
    cancel: useCancelProductionOrder(),
    close: useCloseProductionOrder(),
    resend: useResendDispatch(),
  };
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[kind];
  const pending = hooks[kind].isPending;
  const handlers = {
    onSuccess: onClose,
    onError: (failure: unknown) => setError(productionOrderErrorMessage(failure)),
  };

  const confirm = (reason?: string) => {
    setError(null);
    const version = { id: order.id, version: order.version };
    const text = reason?.trim() ?? "";
    if (kind === "submit") hooks.submit.mutate(version, handlers);
    else if (kind === "approve") hooks.approve.mutate(version, handlers);
    else if (kind === "return") hooks.return.mutate({ ...version, reason: text }, handlers);
    else if (kind === "cancel") hooks.cancel.mutate({ ...version, reason: text }, handlers);
    else if (kind === "close") hooks.close.mutate({ ...version, reason: text }, handlers);
    else hooks.resend.mutate(order.id, handlers);
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirm}
      requireReason={Boolean(copy.reason)}
      reasonLabel={copy.reason}
      reasonMaxLength={PRODUCTION_LIMITS.textMax}
      variant={copy.danger ? "danger" : "default"}
      loading={pending}
      closeOnConfirm={false}
      error={error}
      onConfirm={confirm}
    />
  );
}
