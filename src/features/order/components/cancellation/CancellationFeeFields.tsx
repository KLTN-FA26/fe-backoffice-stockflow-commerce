"use client";

import { useId } from "react";

import { CANCELLATION_REQUEST_LABELS, ORDER_LIMITS } from "@/constants";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { parseFeeAmount } from "../useAgreedFeeFields";

import type { ReasonDialogErrors } from "../useReasonDialogValidation";
import type { CancellationFeeMode, CancellationFeeState } from "./useCancellationFee";

const L = CANCELLATION_REQUEST_LABELS.fee;
const FIELD =
  "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus:border-accent rounded-[var(--r-sm)] text-[0.8125rem]";
const MODES: readonly { mode: CancellationFeeMode; label: string }[] = [
  { mode: "none", label: L.none },
  { mode: "percent", label: L.percent },
  { mode: "agreed", label: L.agreed },
];

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-danger mt-1 text-xs">
      {message}
    </p>
  );
}

/**
 * Phí giữ lại khi duyệt huỷ (docs 17 §4.8 bước 30): mặc định hoàn toàn bộ; chỉ khi Đơn sản xuất đã in hàng loạt mới giữ
 * được phí — FE không biết mốc in (`OrderResponse` không trả) nên BE quyết (409 CANCELLATION_FEE_BEFORE_PRINTING).
 */
export function CancellationFeeFields({
  fee,
  errors,
}: {
  fee: CancellationFeeState;
  errors: ReasonDialogErrors;
}) {
  const baseId = useId();
  const amountId = `${baseId}-amount`;
  const reasonId = `${baseId}-reason`;
  const detailId = `${baseId}-detail`;
  const percentId = `${baseId}-percent`;
  const amountValue = parseFeeAmount(fee.amount);
  return (
    <fieldset className="border-border-default space-y-3 rounded-[var(--r-sm)] border p-3">
      <legend className="text-ink-primary px-1 text-[0.8125rem] font-medium">{L.legend}</legend>
      <div className="space-y-1.5">
        {MODES.map(({ mode, label }) => (
          <label key={mode} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={`${baseId}-mode`}
              checked={fee.mode === mode}
              onChange={() => fee.setMode(mode)}
              className="accent-brand"
            />
            <span className="text-ink-primary text-[0.8125rem]">{label}</span>
          </label>
        ))}
      </div>
      <p className="text-ink-secondary text-xs">{L.hint}</p>
      {fee.mode === "percent" && (
        <div>
          <Label htmlFor={percentId} className="text-[0.8125rem]">
            {L.percentLabel} <span className="text-danger">*</span>
          </Label>
          <Input
            id={percentId}
            type="number"
            step={ORDER_LIMITS.percentInputStep}
            inputMode="decimal"
            value={fee.percent}
            onChange={(event) => fee.setPercent(event.target.value)}
            aria-invalid={errors.retainedPercent ? true : undefined}
            className={`${FIELD} mt-1 w-28 tabular-nums`}
          />
          <FieldError message={errors.retainedPercent} />
        </div>
      )}
      {fee.mode === "agreed" && (
        <div className="space-y-3">
          <div>
            <Label htmlFor={amountId} className="text-[0.8125rem]">
              {L.amountLabel} <span className="text-danger">*</span>
            </Label>
            <Input
              id={amountId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={fee.amount}
              onChange={(event) => fee.setAmount(event.target.value)}
              aria-invalid={errors["agreedFee.amount"] ? true : undefined}
              className={`${FIELD} mt-1 tabular-nums`}
            />
            {Number.isFinite(amountValue) && (
              <p className="text-ink-secondary mt-1 text-xs tabular-nums">
                {formatMoney(amountValue, "VND")}
              </p>
            )}
            <FieldError message={errors["agreedFee.amount"]} />
          </div>
          <div>
            <Label htmlFor={reasonId} className="text-[0.8125rem]">
              {L.reasonLabel} <span className="text-danger">*</span>
            </Label>
            <Input
              id={reasonId}
              type="text"
              value={fee.reason}
              maxLength={ORDER_LIMITS.feeReasonMax}
              onChange={(event) => fee.setReason(event.target.value)}
              aria-invalid={errors["agreedFee.reason"] ? true : undefined}
              className={`${FIELD} mt-1`}
            />
            <FieldError message={errors["agreedFee.reason"]} />
          </div>
          <div>
            <Label htmlFor={detailId} className="text-[0.8125rem]">
              {L.detailLabel} <span className="text-danger">*</span>
            </Label>
            <Textarea
              id={detailId}
              rows={3}
              value={fee.detail}
              maxLength={ORDER_LIMITS.feeDetailMax}
              onChange={(event) => fee.setDetail(event.target.value)}
              aria-invalid={errors["agreedFee.detail"] ? true : undefined}
              className={`${FIELD} mt-1 max-h-40 min-h-20 resize-none`}
            />
            <FieldError message={errors["agreedFee.detail"]} />
          </div>
        </div>
      )}
      <FieldError message={errors.agreedFee} />
    </fieldset>
  );
}
