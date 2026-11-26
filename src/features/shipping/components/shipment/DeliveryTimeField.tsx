"use client";

import { UI_LABELS } from "@/constants";
import { toLocalDateTime } from "@/lib/format";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { Label } from "@/components/ui/label";

import { FieldError } from "../primitives";

const D = UI_LABELS.shipping.shipment.outcomeDialog;

/**
 * Thời điểm giao (docs 09 §4.3 bước 2): giờ hãng báo đã giao, mặc định lúc ghi nhận. Ô ngày giờ gõ được (dd/MM/yyyy
 * HH:mm, 24 giờ) theo giờ Việt Nam như giờ hẹn lấy hàng; `min` là lúc bàn giao lô, `max` là bây giờ — đồng hồ THẬT
 * mỗi lần vẽ lại (không đóng băng lúc mở hộp thoại, nếu không nút "Bây giờ" sẽ vượt `max` sau một phút). Lý do lỗi do
 * `error` (từ `deliveryTimeProblem`) nói. Ngày lập hoá đơn nháp của lô lấy từ đây.
 */
export function DeliveryTimeField({
  value,
  onChange,
  handedOverAt,
  error,
  hint = D.deliveredAtHint,
}: {
  value: string;
  onChange: (value: string) => void;
  handedOverAt?: string | null;
  error?: string | null;
  /** Câu dưới ô; mặc định: để nguyên là lúc ghi nhận. */
  hint?: string;
}) {
  return (
    <div>
      <Label
        htmlFor="outcome-delivered-at"
        className="text-ink-secondary mb-1 block text-xs font-medium"
      >
        {D.deliveredAt}
      </Label>
      <DateTimePicker
        id="outcome-delivered-at"
        value={value}
        min={handedOverAt ? toLocalDateTime(handedOverAt) : undefined}
        max={toLocalDateTime()}
        onChange={onChange}
        showReason={false}
        quick={[{ label: D.deliveredNow, value: () => toLocalDateTime() }]}
        aria-invalid={error ? true : undefined}
        aria-describedby="outcome-delivered-at-hint"
        className="h-8"
      />
      <p id="outcome-delivered-at-hint" className="text-ink-tertiary mt-1 text-xs">
        {hint}
      </p>
      <FieldError>{error ?? undefined}</FieldError>
    </div>
  );
}
