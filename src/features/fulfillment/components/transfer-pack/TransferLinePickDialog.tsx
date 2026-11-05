"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FieldError } from "../primitives";

import type { TransferLinePrompt } from "./useTransferScanFlow";

const S = UI_LABELS.transferPack.scan;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]";

/** Mã quét nằm trên nhiều dòng của lệnh (cùng SKU khác lô; BE `PACK_SCAN_AMBIGUOUS`): chọn đúng dòng rồi quét. */
export function TransferLinePickDialog({
  prompt,
  onSubmit,
  onClose,
}: {
  prompt: TransferLinePrompt;
  onSubmit: (transferLineId: string) => void;
  onClose: () => void;
}) {
  const [lineId, setLineId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!lineId) {
      setError(S.lineRequired);
      return;
    }
    onSubmit(lineId);
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={S.pickLineTitle}
        description={S.pickLineDescription}
        submitLabel={S.pickLineSubmit}
        canSubmit
        isPending={false}
        error={null}
        onSubmit={submit}
        onCancel={onClose}
      >
        <div>
          <Label htmlFor="transfer-scan-line" className="text-[0.8125rem]">
            {S.pickLineLabel}
          </Label>
          <Select
            value={lineId}
            onValueChange={(next) => {
              setLineId(next);
              setError(null);
            }}
          >
            <SelectTrigger id="transfer-scan-line" className={TRIGGER}>
              <SelectValue placeholder={S.pickLineLabel} />
            </SelectTrigger>
            <TitledSelectContent title={S.pickLineTitle}>
              {prompt.candidates.map((line) => (
                <SelectItem key={line.transferLineId} value={line.transferLineId}>
                  {S.pickLineOption(line.lineNo, line.sku, line.lotNumber)}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </Select>
          <FieldError>{error ?? undefined}</FieldError>
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
