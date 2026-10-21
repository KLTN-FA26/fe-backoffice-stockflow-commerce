"use client";

import { useState } from "react";

import { PACKING_LIMITS, UI_LABELS } from "@/constants";
import { scanDetailSchema } from "@/features/fulfillment/packing-input-schemas";
import { lotChoices } from "@/features/fulfillment/packing-selectors";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
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

import { FieldError, fieldClass } from "../primitives";

import type { ScanDetail, ScanPrompt } from "./useScanFlow";

const S = UI_LABELS.packing.scan;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]";

/**
 * Hỏi thêm khi dòng theo dõi theo lô / serial, hoặc mã nằm trên nhiều dòng của đơn (docs 08 bước 2,
 * BE `PackingSession.checkLot` / `checkSerial` / `lineFor`). Lô chọn trong các lô ĐÃ lấy cho dòng.
 */
export function ScanDetailDialog({
  prompt,
  onSubmit,
  onClose,
}: {
  prompt: ScanPrompt;
  onSubmit: (detail: ScanDetail) => void;
  onClose: () => void;
}) {
  const [lineId, setLineId] = useState(
    prompt.candidates.length === 1 ? (prompt.candidates[0]?.orderLineId ?? "") : "",
  );
  const [lot, setLot] = useState("");
  const [serial, setSerial] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const line = prompt.candidates.find((candidate) => candidate.orderLineId === lineId);
  const needsLine = prompt.candidates.length > 1;
  const lots = line ? lotChoices(line) : [];
  const onlyLot = lots.length === 1 ? lots[0]?.lot.lotNumber : undefined;
  const effectiveLot = lot || onlyLot || "";

  const submit = () => {
    const parsed = scanDetailSchema({
      needsLine,
      needsLot: !!line?.lotTracked,
      needsSerial: !!line?.serialTracked,
    }).safeParse({ orderLineId: lineId, lotNumber: effectiveLot, serialNumber: serial });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    onSubmit({
      orderLineId: parsed.data.orderLineId || undefined,
      lotNumber: parsed.data.lotNumber || undefined,
      serialNumber: parsed.data.serialNumber || undefined,
    });
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={S.promptTitle}
        description={S.promptDescription(line?.sku ?? prompt.code)}
        submitLabel={S.promptSubmit}
        canSubmit
        isPending={false}
        error={null}
        onSubmit={submit}
        onCancel={onClose}
      >
        {needsLine && (
          <div>
            <Label htmlFor="scan-line" className="text-[0.8125rem]">
              {S.promptLine}
            </Label>
            <Select value={lineId} onValueChange={setLineId}>
              <SelectTrigger id="scan-line" className={TRIGGER}>
                <SelectValue placeholder={S.promptLinePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {prompt.candidates.map((candidate) => (
                    <SelectItem key={candidate.orderLineId} value={candidate.orderLineId}>
                      {candidate.sku}
                      {candidate.printLine ? " — in theo thiết kế" : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError>{errors.orderLineId}</FieldError>
          </div>
        )}
        {line?.lotTracked && (
          <div>
            <Label htmlFor="scan-lot" className="text-[0.8125rem]">
              {S.promptLot}
            </Label>
            <Select value={effectiveLot} onValueChange={setLot}>
              <SelectTrigger id="scan-lot" className={TRIGGER}>
                <SelectValue placeholder={S.promptLotPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {lots.map(({ lot: choice, left }) => (
                    <SelectItem key={choice.lotNumber} value={choice.lotNumber}>
                      {S.lotOption(choice.lotNumber, left)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError>{errors.lotNumber}</FieldError>
          </div>
        )}
        {line?.serialTracked && (
          <div>
            <Label htmlFor="scan-serial" className="text-[0.8125rem]">
              {S.promptSerial}
            </Label>
            <Input
              id="scan-serial"
              autoFocus
              value={serial}
              maxLength={PACKING_LIMITS.serialMax}
              autoComplete="off"
              aria-invalid={errors.serialNumber ? true : undefined}
              onChange={(event) => setSerial(event.target.value)}
              className={`${fieldClass(!!errors.serialNumber)} font-[family-name:var(--font-mono)]`}
            />
            <p className="text-ink-tertiary mt-1 text-xs">{S.promptSerialHint}</p>
            <FieldError>{errors.serialNumber}</FieldError>
          </div>
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
