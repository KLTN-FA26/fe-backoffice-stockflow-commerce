"use client";

import { PO_LIMITS } from "@/constants";
import { PO_ACTIONS } from "@/features/purchase-order";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { actionDescription } from "./PoActionPanel";
import { PoConfirmationDialog } from "./PoConfirmationDialog";
import { PoRecoverDialog } from "./PoRecoverDialog";
import { PoSendDialog } from "./PoSendDialog";

import type { PoActionCode, PurchaseOrder } from "@/features/purchase-order";
import type { usePoActions } from "./usePoActions";

type Actions = ReturnType<typeof usePoActions>;

/** Mọi thao tác trên PO đều qua một dialog — kể cả Duyệt và Gửi NCC (không thu hồi được). */
export function PoDetailDialogs({
  po,
  supplierName,
  a,
}: {
  po: PurchaseOrder;
  supplierName: string;
  a: Actions;
}) {
  const isOpen = (code: PoActionCode) => a.dialog === code;
  const onOpenChange = (open: boolean) => !open && a.close();
  const shared = { po, isPending: a.isMutating, serverError: a.dialogError, onOpenChange };
  const confirmFor = (
    code: "submit" | "approve" | "reject" | "close" | "cancel" | "closeShort",
  ) => {
    const act = PO_ACTIONS.find((x) => x.code === code);
    return act ? { title: act.label, description: actionDescription(act, po.status) } : null;
  };
  const submit = confirmFor("submit");
  const approve = confirmFor("approve");
  const reject = confirmFor("reject");
  const closeOrder = confirmFor("close");
  const cancel = confirmFor("cancel");
  const closeShort = confirmFor("closeShort");

  return (
    <>
      {submit && (
        <ConfirmDialog
          open={isOpen("submit")}
          onOpenChange={onOpenChange}
          {...submit}
          confirmLabel={submit.title}
          variant="default"
          onConfirm={a.submit}
        />
      )}
      {reject && (
        <ConfirmDialog
          open={isOpen("reject")}
          onOpenChange={onOpenChange}
          {...reject}
          confirmLabel={reject.title}
          requireReason
          reasonMaxLength={PO_LIMITS.rejectReasonMax}
          reasonLabel="Lý do từ chối (bắt buộc)"
          onConfirm={(reason) => a.reject(reason ?? "")}
        />
      )}
      {closeOrder && (
        <ConfirmDialog
          open={isOpen("close")}
          onOpenChange={onOpenChange}
          {...closeOrder}
          confirmLabel={closeOrder.title}
          variant="default"
          onConfirm={a.closePo}
        />
      )}
      {approve && (
        <ConfirmDialog
          open={isOpen("approve")}
          onOpenChange={onOpenChange}
          {...approve}
          confirmLabel={approve.title}
          variant="default"
          onConfirm={a.approve}
        />
      )}
      {/* Huỷ / Đóng thiếu bắt buộc lý do: BE CancelPurchaseOrderRequest / CloseShortRequest
          `reason` @NotBlank, tối đa VARCHAR(255) (BE PR #71). */}
      {cancel && (
        <ConfirmDialog
          open={isOpen("cancel")}
          onOpenChange={onOpenChange}
          {...cancel}
          confirmLabel={cancel.title}
          requireReason
          reasonMaxLength={PO_LIMITS.closeReasonMax}
          reasonLabel="Lý do huỷ (bắt buộc)"
          onConfirm={(reason) => a.cancel(reason ?? "")}
        />
      )}
      {closeShort && (
        <ConfirmDialog
          open={isOpen("closeShort")}
          onOpenChange={onOpenChange}
          {...closeShort}
          confirmLabel={closeShort.title}
          requireReason
          reasonMaxLength={PO_LIMITS.closeReasonMax}
          reasonLabel="Lý do đóng thiếu (bắt buộc)"
          onConfirm={(reason) => a.closeShort(reason ?? "")}
        />
      )}
      <PoSendDialog
        open={isOpen("send")}
        supplierName={supplierName}
        onConfirm={a.send}
        {...shared}
      />
      <PoRecoverDialog open={isOpen("recoverDelivery")} onConfirm={a.recover} {...shared} />
      <PoConfirmationDialog open={isOpen("recordConfirmation")} onConfirm={a.confirm} {...shared} />
    </>
  );
}
