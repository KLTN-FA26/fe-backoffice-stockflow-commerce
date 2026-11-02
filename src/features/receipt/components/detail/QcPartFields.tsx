"use client";

import { RECEIPT_CARTON_LABELS as L, RECEIPT_LIMITS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError } from "../primitives";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { QcDecisionFormInput } from "@/features/receipt/types";

const FIELD = "border-border-default bg-bg-surface mt-1 h-8 rounded-[var(--r-sm)] text-[0.8125rem]";
const F = L.qcFields;

type QcPartKey = "quarantined" | "rejected";
const PARTS: readonly { key: QcPartKey; label: string }[] = [
  { key: "quarantined", label: L.qcOutcome.QUARANTINE },
  { key: "rejected", label: L.qcOutcome.REJECTED },
];

/**
 * Hai phần Cách ly / Không đạt của kết luận QC: SL (lẻ khi dòng có thùng), khu cách ly nhận hàng, lý do (BR-08).
 * Nhãn hiện ngắn ("Khu", "Lý do") để hai phần không trùng tên; tên đầy đủ nằm ở aria-label.
 */
export function QcPartFields({
  loose,
  register,
  errors,
}: {
  /** Dòng có thùng: SL ở đây là hàng lẻ, thùng chọn riêng ở danh sách thùng. */
  loose: boolean;
  register: UseFormRegister<QcDecisionFormInput>;
  errors: FieldErrors<QcDecisionFormInput>;
}) {
  return PARTS.map(({ key, label }) => {
    const name = label.toLowerCase();
    const e = errors[key];
    return (
      <fieldset key={key} className="border-border-default rounded-[var(--r-sm)] border p-3">
        <legend className="text-ink-primary px-1 text-[0.8125rem] font-medium">{label}</legend>
        <p className="text-ink-tertiary mb-2 text-xs">{L.qcPartHint[key]}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[7rem_10rem_minmax(0,1fr)]">
          <div>
            <Label htmlFor={`qc-${key}-qty`} className="text-xs">
              {loose ? L.loose : F.quantity}
            </Label>
            <Input
              id={`qc-${key}-qty`}
              type="number"
              min={0}
              aria-label={L.qcPartQuantity(name, loose)}
              className={`${FIELD} text-right tabular-nums`}
              {...register(`${key}.quantity`, { valueAsNumber: true })}
            />
            <FieldError>{e?.quantity?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor={`qc-${key}-loc`} className="text-xs">
              {F.location}
            </Label>
            <Input
              id={`qc-${key}-loc`}
              maxLength={RECEIPT_LIMITS.codeMax}
              aria-label={L.qcPartLocation(name)}
              className={`${FIELD} font-[family-name:var(--font-mono)] uppercase`}
              {...register(`${key}.locationCode`)}
            />
            <FieldError>{e?.locationCode?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor={`qc-${key}-reason`} className="text-xs">
              {F.reason}
            </Label>
            <Input
              id={`qc-${key}-reason`}
              maxLength={RECEIPT_LIMITS.qcReasonMax}
              aria-label={L.qcPartReason(name)}
              className={FIELD}
              {...register(`${key}.reason`)}
            />
            <FieldError>{e?.reason?.message}</FieldError>
          </div>
        </div>
      </fieldset>
    );
  });
}
