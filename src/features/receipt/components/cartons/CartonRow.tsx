"use client";

import { Trash2 } from "lucide-react";

import { RECEIPT_CARTON_LABELS as L } from "@/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FieldError } from "../primitives";

/**
 * Một thùng trong trình chia thùng: LPN (hoặc "Mới" khi chưa lưu), SL đếm được, chênh lệch so với sức chứa của đơn vị
 * (thùng 1.000 có thể chỉ chứa 980 — SCRUM-473 §3 rule 4), nút bỏ thùng.
 */
export function CartonRow({
  label,
  lpn,
  quantity,
  nominal,
  errors,
  onQuantity,
  onRemove,
}: {
  /** Nhãn ô SL: LPN, hoặc "mới n". */
  label: string;
  lpn: string;
  quantity: number;
  nominal: number | null;
  errors: { quantity?: string; lpn?: string };
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const id = `carton-${label.replace(/\s+/g, "-")}`;
  const diff = nominal !== null && Number.isFinite(quantity) ? quantity - nominal : null;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_7rem_5rem_auto] items-start gap-2 py-1.5">
      <div className="min-w-0 pt-1.5">
        {lpn ? (
          <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] break-all">
            {lpn}
          </span>
        ) : (
          <span className="border-border-default text-ink-secondary rounded-[var(--r-sm)] border px-1.5 py-0.5 text-xs">
            {L.newCarton}
          </span>
        )}
        <FieldError>{errors.lpn}</FieldError>
      </div>
      <div>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          aria-label={L.cartonQuantity(label)}
          aria-invalid={errors.quantity ? true : undefined}
          aria-describedby={errors.quantity ? `${id}-error` : undefined}
          value={Number.isFinite(quantity) ? quantity : ""}
          onChange={(event) => onQuantity(event.target.valueAsNumber)}
          className="border-border-default bg-bg-surface h-8 rounded-[var(--r-sm)] text-right text-[0.8125rem] tabular-nums"
        />
        <FieldError id={`${id}-error`}>{errors.quantity}</FieldError>
      </div>
      <span
        className={`pt-1.5 text-right text-xs tabular-nums ${diff ? "text-warning" : "text-ink-tertiary"}`}
      >
        {diff === null ? "" : L.vsNominal(diff)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label={lpn ? L.removeCarton(lpn) : L.removeNewCarton(label)}
      >
        <Trash2 className="text-danger size-3.5" />
      </Button>
    </li>
  );
}
