"use client";

import { RECEIPT_CARTON_LABELS as L, RECEIPT_LIMITS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError } from "../primitives";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { QcDecisionFormInput } from "@/features/receipt/types";

const FIELD = "border-border-default bg-bg-surface mt-1 h-8 rounded-[var(--r-sm)] text-[0.8125rem]";

export type QcPartKey = "quarantined" | "rejected";

/** Một phần Cách ly / Không đạt của kết luận QC: SL (lẻ khi dòng có thùng), khu cách ly nhận hàng, lý do (BR-08). */
export function QcPartFields({
  part,
  label,
  hint,
  loose,
  register,
  errors,
}: {
  part: QcPartKey;
  label: string;
  hint: string;
  /** Dòng có thùng: SL ở đây là hàng lẻ, thùng chọn riêng ở danh sách thùng. */
  loose: boolean;
  register: UseFormRegister<QcDecisionFormInput>;
  errors: FieldErrors<QcDecisionFormInput>[QcPartKey];
}) {
  const name = label.toLowerCase();
  return (
    <fieldset className="border-border-default rounded-[var(--r-sm)] border p-3">
      <legend className="text-ink-primary px-1 text-[0.8125rem] font-medium">{label}</legend>
      <p className="text-ink-tertiary mb-2 text-xs">{hint}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[7rem_10rem_minmax(0,1fr)]">
        <div>
          <Label htmlFor={`qc-${part}-qty`} className="text-xs">
            {loose ? L.loose : "SL"}
          </Label>
          <Input
            id={`qc-${part}-qty`}
            type="number"
            min={0}
            aria-label={L.qcPartQuantity(name, loose)}
            className={`${FIELD} text-right tabular-nums`}
            {...register(`${part}.quantity`, { valueAsNumber: true })}
          />
          <FieldError>{errors?.quantity?.message}</FieldError>
        </div>
        <div>
          {/* Tên ô đầy đủ ở aria-label ("Khu cách ly" / "Khu không đạt") — chữ ngắn để hai phần không trùng tên */}
          <Label htmlFor={`qc-${part}-loc`} className="text-xs">
            Khu
          </Label>
          <Input
            id={`qc-${part}-loc`}
            maxLength={RECEIPT_LIMITS.codeMax}
            aria-label={L.qcPartLocation(name)}
            className={`${FIELD} font-[family-name:var(--font-mono)] uppercase`}
            {...register(`${part}.locationCode`)}
          />
          <FieldError>{errors?.locationCode?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor={`qc-${part}-reason`} className="text-xs">
            Lý do
          </Label>
          <Input
            id={`qc-${part}-reason`}
            maxLength={RECEIPT_LIMITS.qcReasonMax}
            aria-label={L.qcPartReason(name)}
            className={FIELD}
            {...register(`${part}.reason`)}
          />
          <FieldError>{errors?.reason?.message}</FieldError>
        </div>
      </div>
    </fieldset>
  );
}
