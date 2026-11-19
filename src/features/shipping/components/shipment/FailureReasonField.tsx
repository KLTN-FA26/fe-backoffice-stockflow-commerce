"use client";

import { cn } from "cn";

import {
  ORDER_DELIVERY_FAILURE_LABELS,
  ORDER_DELIVERY_FAILURE_REASONS,
  UI_LABELS,
} from "@/constants";

import { FieldError } from "../primitives";

const D = UI_LABELS.shipping.shipment.outcomeDialog;
const GROUP_LABEL_ID = "outcome-reason-label";

/**
 * Lý do giao thất bại (BE `DeliveryFailureReason`, docs 09 §4.3 bước 3) — bắt buộc khi kết quả là giao thất bại.
 * Sáu thẻ chọn một hiện sẵn (artboard "Ghi nhận giao thất bại"), không phải mở danh sách; ←/→/↑/↓ đổi lựa chọn.
 */
export function FailureReasonField({
  value,
  onChange,
  error,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  error?: string;
}) {
  const reasons = ORDER_DELIVERY_FAILURE_REASONS;
  const selectedIndex = reasons.findIndex((reason) => reason === value);
  const move = (index: number) => {
    const next = reasons[(index + reasons.length) % reasons.length];
    if (next) onChange(next);
  };
  return (
    <div>
      <p id={GROUP_LABEL_ID} className="text-ink-secondary mb-1 text-xs font-medium">
        {D.reason} <span className="text-danger">*</span>
      </p>
      <div
        role="radiogroup"
        aria-labelledby={GROUP_LABEL_ID}
        aria-invalid={error ? true : undefined}
        className="grid grid-cols-2 gap-2"
      >
        {reasons.map((reason, index) => {
          const checked = reason === value;
          return (
            <button
              key={reason}
              type="button"
              role="radio"
              aria-checked={checked}
              // Một điểm dừng Tab cho cả nhóm: thẻ đang chọn (hoặc thẻ đầu khi chưa chọn)
              tabIndex={checked || (selectedIndex < 0 && index === 0) ? 0 : -1}
              onClick={() => onChange(reason)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  move(index + 1);
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  move(index - 1);
                }
              }}
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--r-md)] border px-3 py-2.5 text-left text-[0.8125rem] font-medium transition-colors outline-none",
                "focus-visible:ring-brand/30 focus-visible:ring-2",
                checked
                  ? "border-accent text-ink-primary bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                  : "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "bg-bg-surface size-4 shrink-0 rounded-full border-[1.6px]",
                  checked ? "border-accent border-[5px]" : "border-border-strong",
                )}
              />
              {ORDER_DELIVERY_FAILURE_LABELS[reason]}
            </button>
          );
        })}
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}
