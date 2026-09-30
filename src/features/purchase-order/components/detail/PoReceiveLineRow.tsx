"use client";

import { Input } from "@/components/ui/input";

import type { PoLine } from "@/features/purchase-order";

export function ReceiveLineRow({
  line,
  value,
  error,
  autoFocus,
  onChange,
}: {
  line: PoLine;
  value: string;
  error: string | undefined;
  autoFocus: boolean;
  onChange: (v: string) => void;
}) {
  const inputId = `receive-${line.lineId}`;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex items-start gap-3">
      <label htmlFor={inputId} className="min-w-0 flex-1">
        <span className="text-ink-primary block font-[family-name:var(--font-mono)] text-sm font-medium">
          {line.skuId}
        </span>
        <span className="text-ink-tertiary block text-xs tabular-nums">
          Đặt {line.orderedQty} · Đã nhận {line.receivedQty} ·{" "}
          <span className="text-ink-secondary font-medium">Còn nhận được: {line.openQuantity}</span>
        </span>
      </label>
      <div className="w-28">
        <Input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={line.openQuantity}
          step={1}
          placeholder="SL nhận"
          autoFocus={autoFocus}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus:border-accent text-right tabular-nums"
        />
        {error && (
          <p id={errorId} className="text-danger mt-1 text-xs">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
