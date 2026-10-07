"use client";

import { PO_LIMITS } from "@/constants";
import { PO_ACTIONS } from "@/features/purchase-order";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { actionDescription } from "./PoActionPanel";
import { PoConfirmationDialog } from "./PoConfirmationDialog";
import { PoReceiveDialog } from "./PoReceiveDialog";
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
  const confirmFor = (code: "approve" | "cancel" | "closeShort") => {
    const act = PO_ACTIONS.find((x) => x.code === code);
    return act ? { title: act.label, description: actionDescription(act, po.status) } : null;
  };
  const approve = confirmFor("approve");
  const cancel = confirmFor("cancel");
  const closeShort = confirmFor("closeShort");

  return (
    <>
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
          `reason` @NotBlank, tối đa VARCHAR(1000). */}
      {cancel && (
        <ConfirmDialog
          open={isOpen("cancel")}
          onOpenChange={onOpenChange}
          {...cancel}
          confirmLabel={cancel.title}
          requireReason
          reasonMaxLength={PO_LIMITS.reasonMax}
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
          reasonMaxLength={PO_LIMITS.reasonMax}
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
      <PoReceiveDialog open={isOpen("receive")} onConfirm={a.receive} {...shared} />
      <PoRecoverDialog open={isOpen("recoverDelivery")} onConfirm={a.recover} {...shared} />
      <PoConfirmationDialog open={isOpen("recordConfirmation")} onConfirm={a.confirm} {...shared} />
    </>
  );
}
