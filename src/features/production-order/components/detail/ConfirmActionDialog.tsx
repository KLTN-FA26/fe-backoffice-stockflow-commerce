"use client";

import { useState } from "react";

import { PRODUCTION_LABELS, PRODUCTION_LIMITS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import {
  useCancelProductionOrder,
  useCloseProductionOrder,
  useResendDispatch,
  useSendProductionOrder,
} from "@/features/production-order/mutations";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { ProductionOrder } from "@/features/production-order/types";

const D = PRODUCTION_LABELS.dialogs;
const A = PRODUCTION_LABELS.actions;

export type ConfirmActionKind = "send" | "cancel" | "close" | "resend";

const COPY: Record<
  ConfirmActionKind,
  { title: string; description: string; confirm: string; reason?: string; danger?: boolean }
> = {
  // Docs 17 §4.3 bước 7 (chốt lại 2026-11-20): Điều phối sản xuất gửi thẳng, kể cả đơn mình lập
  send: { title: D.sendTitle, description: D.sendDescription, confirm: A.send },
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
 * Xác nhận thao tác một bước trên Đơn sản xuất: gửi cho đơn vị sản xuất, huỷ, đóng, gửi lại mail. Lý do (≤ 500) bắt
 * buộc với huỷ / đóng. Dialog giữ nguyên tới khi thành công; lỗi hiện trong dialog.
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
    send: useSendProductionOrder(),
    cancel: useCancelProductionOrder(),
    close: useCloseProductionOrder(),
    resend: useResendDispatch(),
  };
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[kind];
  const pending = hooks[kind].isPending;
  const handlers = {
    onSuccess: onClose,
    onError: (failure: unknown) =>
      setError(
        // Gửi lỗi do kho tệp: nói đơn còn Nháp + việc tiếp theo, thay câu lỗi chung
        kind === "send" && failure instanceof ApiError && failure.code === "STORAGE_ERROR"
          ? D.sendStorageError
          : productionOrderErrorMessage(failure),
      ),
  };

  const confirm = (reason?: string) => {
    setError(null);
    const version = { id: order.id, version: order.version };
    const text = reason?.trim() ?? "";
    if (kind === "send") hooks.send.mutate(version, handlers);
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
      confirmLabel={error ? D.retry : copy.confirm}
      requireReason={Boolean(copy.reason)}
      reasonLabel={copy.reason}
      reasonMaxLength={PRODUCTION_LIMITS.textMax}
      variant={copy.danger ? "danger" : "default"}
      loading={pending}
      closeOnConfirm={false}
      error={error}
      onConfirm={confirm}
    >
      {kind === "send" && (
        <ul className="text-ink-secondary list-disc space-y-1 pl-5 text-[0.8125rem]">
          {D.sendSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      )}
    </ConfirmDialog>
  );
}
