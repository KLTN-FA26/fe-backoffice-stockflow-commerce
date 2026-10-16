"use client";

import { useState } from "react";

import { PO_LIMITS, PO_STATUS, SUPPLIER_CONFIRMATION_STATUS, UI_LABELS } from "@/constants";
import { PO_REASON_MAX, supplierConfirmationInputSchema } from "@/features/purchase-order";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { PoDialog, PoDialogForm } from "./PoDialog";

import type { PurchaseOrder, SupplierConfirmationInput } from "@/features/purchase-order";

type Response = SupplierConfirmationInput["status"];

interface PoConfirmationDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  po: PurchaseOrder;
  isPending: boolean;
  serverError: string | null;
  onConfirm: (input: SupplierConfirmationInput) => void;
}

/**
 * Ghi nhận phản hồi của NCC (BE `/supplier-confirmation`, quyền UPDATE). Phản hồi đã ghi thì
 * không sửa được; NCC từ chối cần lý do và chỉ được khi PO còn SENT (chưa nhận hàng).
 */
export function PoConfirmationDialog({
  open,
  onOpenChange,
  ...formProps
}: PoConfirmationDialogProps) {
  return (
    <PoDialog open={open} onOpenChange={onOpenChange}>
      <ConfirmationForm onCancel={() => onOpenChange(false)} {...formProps} />
    </PoDialog>
  );
}

function ConfirmationForm({
  po,
  isPending,
  serverError,
  onConfirm,
  onCancel,
}: Omit<PoConfirmationDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  // BE: chỉ từ chối được khi PO còn CONFIRMED (chưa nhận hàng).
  const options: { value: Response; label: string }[] = [
    { value: SUPPLIER_CONFIRMATION_STATUS.CONFIRMED, label: "NCC xác nhận" },
    ...(po.status === PO_STATUS.CONFIRMED
      ? [{ value: SUPPLIER_CONFIRMATION_STATUS.REJECTED, label: "NCC từ chối" }]
      : []),
  ];
  const [status, setStatus] = useState<Response>(SUPPLIER_CONFIRMATION_STATUS.CONFIRMED);
  const [supplierReference, setSupplierReference] = useState("");
  const [note, setNote] = useState("");
  const parsed = supplierConfirmationInputSchema.safeParse({ status, supplierReference, note });
  const noteError = parsed.success
    ? undefined
    : parsed.error.issues.find((i) => i.path[0] === "note")?.message;

  return (
    <PoDialogForm
      title={UI_LABELS.purchaseOrder.action.recordConfirmation}
      description={`Phản hồi của NCC cho đơn ${po.poNumber}. Đã ghi nhận thì không sửa được.`}
      submitLabel="Ghi nhận"
      canSubmit={parsed.success}
      isPending={isPending}
      error={serverError}
      danger={status === SUPPLIER_CONFIRMATION_STATUS.REJECTED}
      onSubmit={() => parsed.success && onConfirm(parsed.data)}
      onCancel={onCancel}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="po-confirm-status" className="text-ink-secondary text-xs font-medium">
          {UI_LABELS.purchaseOrder.supplierResponse} <span className="text-danger">*</span>
        </Label>
        <Select
          value={status}
          onValueChange={(v) => {
            const next = options.find((o) => o.value === v);
            if (next) setStatus(next.value);
          }}
        >
          <SelectTrigger id="po-confirm-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="po-confirm-ref" className="text-ink-secondary text-xs font-medium">
          Mã tham chiếu của NCC
        </Label>
        <Input
          id="po-confirm-ref"
          value={supplierReference}
          maxLength={PO_LIMITS.supplierReferenceMax}
          onChange={(e) => setSupplierReference(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="po-confirm-note" className="text-ink-secondary text-xs font-medium">
          Ghi chú{" "}
          {status === SUPPLIER_CONFIRMATION_STATUS.REJECTED && (
            <span className="text-danger">*</span>
          )}
        </Label>
        <Textarea
          id="po-confirm-note"
          rows={3}
          maxLength={PO_REASON_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {status === SUPPLIER_CONFIRMATION_STATUS.REJECTED && noteError && (
          <p className="text-danger text-xs">{noteError}</p>
        )}
      </div>
    </PoDialogForm>
  );
}
