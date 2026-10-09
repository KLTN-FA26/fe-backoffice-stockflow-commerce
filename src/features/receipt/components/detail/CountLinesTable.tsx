"use client";

import { CountLineRow } from "./CountLineRow";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { ReceiptLinesFormInput, ReceivablePoLine } from "@/features/receipt/types";

const HEADERS = ["SKU", "SL nhận", "Số lô", "Hạn dùng", "Vị trí nhận", "Ghi chú", ""];

/** Bảng dòng kiểm đếm (useFieldArray) — mỗi dòng một dòng PO × một lô. */
export function CountLinesTable({
  receiptNumber,
  rowIds,
  lines,
  poLineById,
  overOpen,
  register,
  errors,
  onSplit,
  onRemove,
}: {
  receiptNumber: string;
  /** `field.id` của useFieldArray — key ổn định cho từng dòng. */
  rowIds: readonly string[];
  lines: ReceiptLinesFormInput["lines"];
  poLineById: ReadonlyMap<string, ReceivablePoLine>;
  overOpen: ReadonlySet<string>;
  register: UseFormRegister<ReceiptLinesFormInput>;
  errors: FieldErrors<ReceiptLinesFormInput>["lines"];
  onSplit: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">Dòng kiểm đếm của phiếu {receiptNumber}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            {HEADERS.map((h, i) => (
              <th
                key={h || i}
                scope="col"
                className={`px-2 py-2 font-medium ${i === 1 ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowIds.map((rowId, index) => {
            const poLineId = lines[index]?.purchaseOrderLineId ?? "";
            return (
              <CountLineRow
                key={rowId}
                index={index}
                poLine={poLineById.get(poLineId)}
                register={register}
                errors={errors}
                overOpen={overOpen.has(poLineId)}
                autoFocus={index === 0}
                onSplit={() => onSplit(index)}
                onRemove={() => onRemove(index)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
