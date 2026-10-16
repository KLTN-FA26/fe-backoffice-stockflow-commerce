"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { RECEIPT_LIMITS, UI_LABELS } from "@/constants";
import { receiptErrorMessage } from "@/features/receipt/errors";
import { buildQcDecisionSchema } from "@/features/receipt/input-schemas";
import { useInspectLine } from "@/features/receipt/mutations";
import { movedToQcQuantity } from "@/features/receipt/selectors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError } from "../primitives";
import { ReceiptDialog } from "./ReceiptDialog";

import type {
  QcDecisionFormInput,
  QcDecisionValues,
  ReceiptLineDto,
} from "@/features/receipt/types";

const FIELD = "border-border-default bg-bg-surface mt-1 h-8 rounded-[var(--r-sm)] text-[0.8125rem]";
const EMPTY_PART = { quantity: 0, locationCode: "", reason: "" };

type PartKey = "quarantined" | "rejected";
const PARTS: { key: PartKey; label: string; hint: string }[] = [
  { key: "quarantined", label: "Cách ly", hint: "Chờ kết luận lại — vào khu QUARANTINE" },
  { key: "rejected", label: "Không đạt", hint: "Trả NCC — vào khu QUARANTINE, tồn Blocked" },
];

/**
 * Docs 03 bước 8–9 (BR-08): chia SL đã chuyển sang khu QC thành Đạt / Cách ly / Không đạt.
 * Tổng hiện realtime; phần cách ly / không đạt cần khu cách ly và lý do.
 */
export function InspectDialog({
  receiptId,
  line,
  onClose,
}: {
  receiptId: string;
  line: ReceiptLineDto;
  onClose: () => void;
}) {
  const moved = movedToQcQuantity(line);
  const schema = useMemo(() => buildQcDecisionSchema(moved), [moved]);
  const form = useForm<QcDecisionFormInput, unknown, QcDecisionValues>({
    resolver: zodResolver(schema),
    defaultValues: { accepted: moved, quarantined: EMPTY_PART, rejected: EMPTY_PART },
    mode: "onChange",
  });
  const inspect = useInspectLine();
  const [serverError, setServerError] = useState<string | null>(null);
  const errors = form.formState.errors;
  const values = useWatch({ control: form.control });
  const total =
    (Number(values.accepted) || 0) +
    (Number(values.quarantined?.quantity) || 0) +
    (Number(values.rejected?.quantity) || 0);

  const submit = form.handleSubmit((decision) =>
    inspect.mutate(
      { receiptId, lineId: line.id, decision },
      { onSuccess: onClose, onError: (error) => setServerError(receiptErrorMessage(error)) },
    ),
  );

  return (
    <ReceiptDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={UI_LABELS.receipt.action.inspect}
      description={`${line.sku ?? ""}${line.lotNumber ? ` — lô ${line.lotNumber}` : ""}: ${moved} đơn vị đang ở khu QC ${line.qcLocationCode ?? ""}.`}
      submitLabel={UI_LABELS.receipt.action.inspect}
      isPending={inspect.isPending}
      error={serverError}
      onEdit={() => setServerError(null)}
      onSubmit={() => void submit()}
    >
      <div>
        <Label htmlFor="qc-accepted" className="text-[0.8125rem]">
          Đạt
        </Label>
        <Input
          id="qc-accepted"
          type="number"
          min={0}
          autoFocus
          className={`${FIELD} w-32 text-right tabular-nums`}
          aria-invalid={errors.accepted ? true : undefined}
          aria-describedby={errors.accepted ? "qc-sum-error" : undefined}
          {...form.register("accepted", { valueAsNumber: true })}
        />
      </div>
      {PARTS.map(({ key, label, hint }) => (
        <fieldset key={key} className="border-border-default rounded-[var(--r-sm)] border p-3">
          <legend className="text-ink-primary px-1 text-[0.8125rem] font-medium">{label}</legend>
          <p className="text-ink-tertiary mb-2 text-xs">{hint}</p>
          <div className="grid gap-2 sm:grid-cols-[7rem_10rem_1fr]">
            <div>
              <Label htmlFor={`qc-${key}-qty`} className="text-xs">
                SL
              </Label>
              <Input
                id={`qc-${key}-qty`}
                type="number"
                min={0}
                className={`${FIELD} text-right tabular-nums`}
                {...form.register(`${key}.quantity`, { valueAsNumber: true })}
              />
              <FieldError>{errors[key]?.quantity?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor={`qc-${key}-loc`} className="text-xs">
                Khu cách ly
              </Label>
              <Input
                id={`qc-${key}-loc`}
                maxLength={RECEIPT_LIMITS.codeMax}
                className={`${FIELD} font-[family-name:var(--font-mono)] uppercase`}
                {...form.register(`${key}.locationCode`)}
              />
              <FieldError>{errors[key]?.locationCode?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor={`qc-${key}-reason`} className="text-xs">
                Lý do
              </Label>
              <Input
                id={`qc-${key}-reason`}
                maxLength={RECEIPT_LIMITS.qcReasonMax}
                className={FIELD}
                {...form.register(`${key}.reason`)}
              />
              <FieldError>{errors[key]?.reason?.message}</FieldError>
            </div>
          </div>
        </fieldset>
      ))}
      <p
        className={`text-[0.8125rem] tabular-nums ${total === moved ? "text-ink-secondary" : "text-danger"}`}
        aria-live="polite"
      >
        Tổng: {total} / {moved}
      </p>
      <FieldError id="qc-sum-error">{errors.accepted?.message}</FieldError>
    </ReceiptDialog>
  );
}
