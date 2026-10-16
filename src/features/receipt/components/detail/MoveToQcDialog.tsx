"use client";

import { useState } from "react";

import { RECEIPT_LIMITS, UI_LABELS } from "@/constants";
import { receiptErrorMessage } from "@/features/receipt/errors";
import { moveToQcInputSchema } from "@/features/receipt/input-schemas";
import { useMoveLineToQc } from "@/features/receipt/mutations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError } from "../primitives";
import { ReceiptDialog } from "./ReceiptDialog";

import type { ReceiptLineDto } from "@/features/receipt/types";

/** Docs 03 bước 7: NV kho quét mã khu QUALITY_CONTROL — BE ghi movement RECEIVING → QC. */
export function MoveToQcDialog({
  receiptId,
  line,
  onClose,
}: {
  receiptId: string;
  line: ReceiptLineDto;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const move = useMoveLineToQc();

  const submit = () => {
    const parsed = moveToQcInputSchema.safeParse({ qcLocationCode: code });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    move.mutate(
      { receiptId, lineId: line.id, qcLocationCode: parsed.data.qcLocationCode },
      { onSuccess: onClose, onError: (error) => setServerError(receiptErrorMessage(error)) },
    );
  };

  return (
    <ReceiptDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={UI_LABELS.receipt.action.moveToQc}
      description={`Chuyển ${line.quantity} ${line.sku ?? ""}${line.lotNumber ? ` (lô ${line.lotNumber})` : ""} từ khu nhận hàng sang khu kiểm tra chất lượng.`}
      submitLabel={UI_LABELS.receipt.action.moveToQc}
      isPending={move.isPending}
      error={serverError}
      onEdit={() => setServerError(null)}
      onSubmit={submit}
    >
      <div>
        <Label htmlFor="qc-location" className="text-[0.8125rem]">
          Mã khu QC
        </Label>
        <Input
          id="qc-location"
          autoFocus
          value={code}
          maxLength={RECEIPT_LIMITS.codeMax}
          placeholder="Quét / nhập mã khu QUALITY_CONTROL"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "qc-location-error" : undefined}
          onChange={(event) => {
            setCode(event.target.value);
            // Gõ / quét lại → bỏ lỗi cũ, kiểm lại khi gửi
            setFieldError(undefined);
          }}
          className="border-border-default bg-bg-surface mt-1 rounded-[var(--r-sm)] font-[family-name:var(--font-mono)] uppercase"
        />
        <FieldError id="qc-location-error">{fieldError}</FieldError>
      </div>
    </ReceiptDialog>
  );
}
