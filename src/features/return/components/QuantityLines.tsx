"use client";

import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";

import { MONO } from "./primitives";

import type { UseFormRegisterReturn } from "react-hook-form";

interface Row {
  key: string;
  sku: string;
  /** Chữ phụ cạnh SKU (vd "in theo thiết kế", "đã giao 24"). */
  hint?: string;
  cap: number;
}

/**
 * Bảng nhập số lượng theo dòng (duyệt / đề xuất hoàn / mở yêu cầu): ô số nguyên 0..trần, lỗi theo dòng. Trần do màn
 * tính (selectors) — BE kiểm lại.
 */
export function QuantityLines({
  rows,
  field,
  errorOf,
  label,
  capLabel,
  idPrefix,
}: {
  rows: readonly Row[];
  /** `register("lines.{i}.quantity", { valueAsNumber: true })` của form gọi. */
  field: (index: number) => UseFormRegisterReturn;
  errorOf: (index: number) => string | undefined;
  label: string;
  capLabel: (cap: number) => string;
  idPrefix: string;
}) {
  return (
    <table className="w-full text-[0.8125rem]">
      <caption className="sr-only">{label}</caption>
      <tbody className="divide-y divide-[var(--table-line)]">
        {rows.map((row, index) => {
          const id = `${idPrefix}-${index}`;
          const error = errorOf(index);
          return (
            <tr key={row.key}>
              <td className="py-1.5 pr-3">
                <span className={MONO}>{row.sku}</span>
                {row.hint && <span className="text-ink-tertiary ml-2 text-xs">{row.hint}</span>}
              </td>
              <td className="w-40 py-1.5">
                <label htmlFor={id} className="sr-only">
                  {`${label} ${row.sku}`}
                </label>
                <Input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={row.cap}
                  aria-invalid={!!error}
                  aria-describedby={`${id}-cap`}
                  className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
                  {...field(index)}
                />
                <p id={`${id}-cap`} className="text-ink-tertiary mt-0.5 text-right text-xs">
                  {capLabel(row.cap)}
                </p>
                {error && (
                  <p role="alert" className="text-danger text-right text-xs">
                    {error}
                  </p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
