"use client";

import { cn } from "cn";

import { CARRIER_CONNECTION_TYPES, UI_LABELS } from "@/constants";

import type { CarrierConnectionType } from "@/constants";

const C = UI_LABELS.shipping.waybill.carriers;

/**
 * Kiểu kết nối dạng thẻ chọn (artboard "Thêm hãng vận chuyển"): mỗi thẻ có sẵn câu giải thích. Radio group đúng ARIA: mũi tên
 * chuyển thẻ, Tab vào thẻ đang chọn.
 */
export function ConnectionTypeCards({
  value,
  onChange,
}: {
  value: CarrierConnectionType;
  onChange: (next: CarrierConnectionType) => void;
}) {
  const move = (from: number, step: number) => {
    const next =
      CARRIER_CONNECTION_TYPES[
        (from + step + CARRIER_CONNECTION_TYPES.length) % CARRIER_CONNECTION_TYPES.length
      ];
    if (next) onChange(next);
  };
  return (
    <div
      role="radiogroup"
      aria-labelledby="carrier-connectionType-label"
      className="flex flex-col gap-2"
    >
      {CARRIER_CONNECTION_TYPES.map((type, index) => {
        const on = type === value;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={on}
            aria-labelledby={`carrier-conn-${type}-title`}
            aria-describedby={`carrier-conn-${type}-hint`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(type)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "focus-visible:ring-brand/30 flex items-start gap-2.5 rounded-[var(--r-md)] border px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-2",
              on
                ? "border-brand bg-brand/5"
                : "border-border-default bg-bg-surface hover:bg-bg-subtle",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "bg-bg-surface mt-0.5 size-4 shrink-0 rounded-full border-[1.6px]",
                on ? "border-brand border-[5px]" : "border-border-strong",
              )}
            />
            <span className="min-w-0">
              <span
                id={`carrier-conn-${type}-title`}
                className="text-ink-primary block text-[0.8125rem] font-semibold"
              >
                {C.connectionType[type]}
              </span>
              <span id={`carrier-conn-${type}-hint`} className="text-ink-secondary block text-xs">
                {C.connectionHint[type]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
