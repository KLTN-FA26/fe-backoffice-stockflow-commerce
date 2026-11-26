"use client";

import { UI_LABELS } from "@/constants";
import { toLocalDateTime } from "@/lib/format";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { Label } from "@/components/ui/label";

import { toLocalInput } from "@/features/shipping/delivery-time";

import { FieldError } from "../primitives";

const D = UI_LABELS.shipping.shipment.outcomeDialog;

/**
 * Thời điểm giao (docs 09 §4.3 bước 2): giờ hãng báo đã giao, mặc định lúc ghi nhận. Ô ngày giờ gõ được (dd/MM/yyyy
 * HH:mm, 24 giờ) theo giờ Việt Nam như giờ hẹn lấy hàng; `min` là lúc bàn giao lô, `max` là bây giờ. Ngày lập hoá đơn nháp của lô lấy từ đây.
 */
export function DeliveryTimeField({
  value,
  onChange,
  handedOverAt,
  now,
  error,
  hint = D.deliveredAtHint,
}: {
  value: string;
  onChange: (value: string) => void;
  handedOverAt?: string | null;
  now: Date;
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
        min={handedOverAt ? toLocalInput(handedOverAt) : undefined}
        max={toLocalInput(now)}
        onChange={onChange}
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
