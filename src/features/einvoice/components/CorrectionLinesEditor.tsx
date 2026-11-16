"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import type { EInvoiceLine } from "../types";

export interface DraftLine {
  originalLineId: string;
  include: boolean;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

const CELL = "py-1.5 pr-2";

/**
 * Dòng chỉnh theo dòng của hoá đơn gốc (BE `CorrectionLineRequest`). Điều chỉnh: số lượng có dấu (âm =
 * giảm); thay thế: số lượng mới (0 = bỏ dòng). Giá / thuế suất chỉ sửa khi sai sót (`priced`).
 */
export function CorrectionLinesEditor({
  lines,
  value,
  onChange,
  mode,
  priced,
}: {
  lines: EInvoiceLine[];
  value: DraftLine[];
  onChange: (next: DraftLine[]) => void;
  mode: "adjust" | "replace";
  priced: boolean;
}) {
  const set = (index: number, patch: Partial<DraftLine>) =>
    onChange(value.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  return (
    <table className="w-full text-[0.8125rem]">
      <thead className="text-ink-tertiary text-left">
        <tr>
          <th className={CELL}>Chỉnh</th>
          <th className={CELL}>Dòng</th>
          <th className={CELL}>{mode === "adjust" ? "SL chỉnh (±)" : "SL mới"}</th>
          {priced && <th className={CELL}>Đơn giá</th>}
          {priced && <th className={CELL}>Thuế suất (%)</th>}
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => {
          const row = value[index];
          if (!row) return null;
          return (
            <tr key={line.id}>
              <td className={CELL}>
                <Checkbox
                  aria-label={`Chỉnh dòng ${line.lineNo}`}
                  checked={row.include}
                  onCheckedChange={(checked) => set(index, { include: checked === true })}
                />
              </td>
              <td className={CELL}>
                {line.lineNo}. {line.itemName}
              </td>
              <td className={CELL}>
                <Input
                  aria-label={`Số lượng dòng ${line.lineNo}`}
                  inputMode="numeric"
                  disabled={!row.include}
                  value={row.quantity}
                  onChange={(event) => set(index, { quantity: event.target.value })}
                  className="h-8 w-28"
                />
              </td>
              {priced && (
                <td className={CELL}>
                  <Input
                    aria-label={`Đơn giá dòng ${line.lineNo}`}
                    inputMode="numeric"
                    disabled={!row.include}
                    value={row.unitPrice}
                    onChange={(event) => set(index, { unitPrice: event.target.value })}
                    className="h-8 w-28"
                  />
                </td>
              )}
              {priced && (
                <td className={CELL}>
                  <Input
                    aria-label={`Thuế suất dòng ${line.lineNo}`}
                    inputMode="decimal"
                    disabled={!row.include}
                    value={row.taxRate}
                    onChange={(event) => set(index, { taxRate: event.target.value })}
                    className="h-8 w-20"
                  />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const num = (text: string) => (text.trim() === "" ? undefined : Number(text));

/** Dòng được chọn → `CorrectionLineRequest`; thuế suất nhập % đổi về phân số như BE. */
export function toCorrectionLines(value: DraftLine[], priced: boolean) {
  return value
    .filter((line) => line.include)
    .map((line) => {
      const rate = num(line.taxRate);
      return {
        originalLineId: line.originalLineId,
        quantity: num(line.quantity),
        ...(priced
          ? { unitPrice: num(line.unitPrice), taxRate: rate === undefined ? undefined : rate / 100 }
          : {}),
      };
    });
}

export function draftLinesOf(lines: EInvoiceLine[], mode: "adjust" | "replace"): DraftLine[] {
  return lines.map((line) => ({
    originalLineId: line.id,
    include: mode === "replace",
    quantity: mode === "replace" ? String(line.quantity) : "",
    unitPrice: String(line.unitPrice),
    taxRate: line.taxRate == null ? "" : String(Math.round(line.taxRate * 10000) / 100),
  }));
}
