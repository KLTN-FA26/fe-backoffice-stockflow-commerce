"use client";

import { useId, useState } from "react";

import { ORDER_LIMITS, ORDER_REMAINDER_FEE_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { ReasonDialogErrors } from "./OrderReasonDialog";

const FIELD =
  "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus:border-accent rounded-[var(--r-sm)] text-[0.8125rem]";

/** Một chuỗi chữ số liền, hoặc các nhóm 3 chữ số cùng dùng một dấu nghìn (chấm, phẩy hoặc khoảng trắng). */
const AMOUNT_TEXT = /^(?:\d+|\d{1,3}(?:([.,\s])\d{3}(?:\1\d{3})*))$/;

/**
 * Số tiền gõ vào → số nguyên VND. Chỉ nhận chữ số liền ("4000000") hoặc nhóm 3 chữ số cùng một dấu nghìn
 * ("4.000.000", "4,000,000", "4 000 000"). Mọi dạng khác — dấu thập phân ("150000.50", "1,5"), trộn dấu
 * ("150.000,5"), ký tự lạ, trống — trả NaN để schema báo "Nhập số tiền nguyên lớn hơn 0" thay vì lặng lẽ đọc
 * sai thành một số khác (VND không có số lẻ, `Order#requireRemainderFee`).
 */
export function parseFeeAmount(text: string): number {
  const trimmed = text.trim();
  if (!AMOUNT_TEXT.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(/[.,\s]/g, ""));
}

/** Trạng thái ô "phí đã thoả thuận" của hộp thoại đóng phần còn lại. */
export function useAgreedFeeFields() {
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  return {
    enabled,
    amount,
    reason,
    detail,
    setEnabled,
    setAmount,
    setReason,
    setDetail,
    /** Phần gộp vào input của schema: không bật thì không gửi `agreedFee`. */
    values: {
      agreedFee: enabled ? { amount: parseFeeAmount(amount), reason, detail } : undefined,
    },
    reset: () => {
      setEnabled(false);
      setAmount("");
      setReason("");
      setDetail("");
    },
  };
}

export type AgreedFeeFields = ReturnType<typeof useAgreedFeeFields>;

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
        </div>
      )}
    </div>
  );
}
