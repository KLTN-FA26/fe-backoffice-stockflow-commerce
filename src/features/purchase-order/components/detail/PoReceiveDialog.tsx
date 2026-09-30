"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { validateReceiveDraft } from "@/features/purchase-order";

import { ReceiveLineRow } from "./PoReceiveLineRow";

import type { PurchaseOrder } from "@/features/purchase-order";

interface PoReceiveDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  po: PurchaseOrder;
  isPending: boolean;
  /** Server-side failure to show inside the dialog (set by the caller's onError). */
  serverError: string | null;
  onConfirm: (lines: { lineId: string; quantity: number }[]) => void;
}

export function PoReceiveDialog({ open, onOpenChange, ...formProps }: PoReceiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Same shell as shared ConfirmDialog (header border · padded body · bg.subtle footer). */}
      <DialogContent
        showCloseButton={false}
        className="border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-[520px]"
      >
        {/* Form state lives in a child of DialogContent: Radix unmounts it on close,
            so quantities typed earlier are reset every time the dialog reopens. */}
        <ReceiveForm onCancel={() => onOpenChange(false)} {...formProps} />
      </DialogContent>
    </Dialog>
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
  const canSubmit = lines.length > 0 && !hasErrors && !isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onConfirm(lines);
      }}
    >
      <DialogHeader className="border-border-default border-b px-[18px] py-4">
        <DialogTitle className="text-ink-primary font-[family-name:var(--font-display)] text-[1.05rem] leading-tight font-semibold">
          Nhận hàng
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 px-[18px] py-[18px]">
        <DialogDescription className="text-ink-secondary text-[0.875rem] leading-relaxed">
          Nhập số lượng thực nhận cho các dòng cần nhận. Để trống dòng chưa nhận lần này.
        </DialogDescription>
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
        {serverError && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            {serverError}
          </p>
        )}
        {!canSubmit && !hasErrors && !isPending && (
          <p className="text-ink-tertiary text-xs">Nhập SL nhận cho ít nhất một dòng.</p>
        )}
      </div>
      <DialogFooter className="border-border-default bg-bg-subtle mx-0 mb-0 rounded-b-[var(--r-xl)] border-t px-[18px] py-[14px]">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="border-border-strong bg-bg-surface text-ink-primary hover:bg-bg-muted rounded-[var(--r-sm)]"
        >
          Huỷ
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit}
          className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)] disabled:opacity-50"
        >
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          Xác nhận nhận hàng
        </Button>
      </DialogFooter>
    </form>
  );
}
