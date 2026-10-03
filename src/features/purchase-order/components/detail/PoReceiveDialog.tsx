"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { validateReceiveDraft } from "@/features/purchase-order";

import { PoDialog, PoDialogForm } from "./PoDialog";
import { ReceiveLineRow } from "./PoReceiveLineRow";

import type { PurchaseOrder, ReceiveLineInput } from "@/features/purchase-order";

interface PoReceiveDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  po: PurchaseOrder;
  isPending: boolean;
  /** Lỗi từ server (đã map tiếng Việt) — hiện trong dialog. */
  serverError: string | null;
  onConfirm: (lines: ReceiveLineInput[]) => void;
}

export function PoReceiveDialog({ open, onOpenChange, ...formProps }: PoReceiveDialogProps) {
  return (
    <PoDialog open={open} onOpenChange={onOpenChange}>
      <ReceiveForm onCancel={() => onOpenChange(false)} {...formProps} />
    </PoDialog>
  );
}

function ReceiveForm({
  po,
  isPending,
  serverError,
  onConfirm,
  onCancel,
}: Omit<PoReceiveDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const receivable = po.lines.filter((l) => l.openQuantity > 0);
  const { lines, errors } = validateReceiveDraft(receivable, draft);
  const hasErrors = Object.keys(errors).length > 0;
  const canSubmit = lines.length > 0 && !hasErrors;

  return (
    <PoDialogForm
      title={UI_LABELS.purchaseOrder.action.receive}
      description="Nhập số lượng thực nhận cho các dòng cần nhận. Để trống dòng chưa nhận lần này."
      submitLabel="Xác nhận nhận hàng"
      canSubmit={canSubmit}
      isPending={isPending}
      error={serverError}
      onSubmit={() => onConfirm(lines)}
      onCancel={onCancel}
    >
      {receivable.map((l, i) => (
        <ReceiveLineRow
          key={l.lineId}
          line={l}
          value={draft[l.lineId] ?? ""}
          error={errors[l.lineId]}
          autoFocus={i === 0}
          onChange={(v) => setDraft((p) => ({ ...p, [l.lineId]: v }))}
        />
      ))}
      {!canSubmit && !hasErrors && !isPending && (
        <p className="text-ink-tertiary text-xs">Nhập SL nhận cho ít nhất một dòng.</p>
      )}
    </PoDialogForm>
  );
}
