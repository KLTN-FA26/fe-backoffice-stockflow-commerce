"use client";

import { useId } from "react";

import { ORDER_LIMITS, ORDER_REMAINDER_FEE_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FeeBearerField } from "./FeeBearerField";
import { parseFeeAmount, type AgreedFeeFields } from "./useAgreedFeeFields";

import type { ReasonDialogErrors } from "./useReasonDialogValidation";

const FIELD =
  "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus:border-accent rounded-[var(--r-sm)] text-[0.8125rem]";

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-danger mt-1 text-xs">
      {message}
    </p>
  );
}

/**
 * Khoản phí đã thoả thuận khi đóng phần còn lại (BE PR #150): tuỳ chọn, chỉ có nghĩa khi hàng in đã bắt
 * đầu in. Tối đa bằng giá trị phần hàng in bị đóng — BE kiểm tra (400), FE không đoán được con số đó.
 */
export function RemainderFeeFields({
  fee,
  errors,
}: {
  fee: AgreedFeeFields;
  errors: ReasonDialogErrors;
}) {
  const toggleId = useId();
  const amountId = useId();
  const reasonId = useId();
  const detailId = useId();
  const L = ORDER_REMAINDER_FEE_LABELS;

  return (
    <div className="border-border-default space-y-3 rounded-[var(--r-sm)] border p-3">
      <div>
        <label htmlFor={toggleId} className="flex cursor-pointer items-start gap-2">
          <input
            id={toggleId}
            type="checkbox"
            checked={fee.enabled}
            onChange={(event) => fee.setEnabled(event.target.checked)}
            className="accent-brand mt-1"
          />
          <span className="text-ink-primary text-[0.8125rem] font-medium">{L.toggle}</span>
        </label>
        <p className="text-ink-secondary mt-1 pl-6 text-xs">{L.toggleHint}</p>
      </div>
      {fee.enabled && (
        <div className="space-y-3">
          <div>
            <Label htmlFor={amountId} className="text-[0.8125rem]">
              {L.amount} <span className="text-danger">*</span>
            </Label>
            {/* R5: số tiền dùng MoneyInput — chấm nghìn khi gõ, hậu tố ₫, không nhập số lẻ. */}
            <MoneyInput
              id={amountId}
              value={fee.amount}
              onChange={fee.setAmount}
              aria-invalid={errors["agreedFee.amount"] ? true : undefined}
              className="mt-1"
            />
            {Number.isFinite(parseFeeAmount(fee.amount)) && (
              <p className="text-ink-secondary mt-1 text-xs tabular-nums">
                {L.amountPreview(formatMoney(parseFeeAmount(fee.amount), "VND"))}
              </p>
            )}
            <FieldError message={errors["agreedFee.amount"]} />
          </div>
          <div>
            <Label htmlFor={reasonId} className="text-[0.8125rem]">
              {L.reason} <span className="text-danger">*</span>
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
              {L.detail} <span className="text-danger">*</span>
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
          <FeeBearerField
            value={fee.feeBearer}
            onChange={fee.setFeeBearer}
            error={errors.feeBearer}
          />
        </div>
      )}
    </div>
  );
}
