"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { PoLineRow } from "./PoLineRow";

import type { CreatePoWizard } from "./useCreateForm";

const COL = UI_LABELS.purchaseOrder.linesStep.columns;
const TH = "text-ink-secondary px-2 py-2 text-left text-xs font-medium whitespace-nowrap";

/**
 * Bảng nhập dòng hàng (bước 2): một hàng mỗi dòng, header dính khi cuộn. Ở chế độ mở rộng khung
 * cuộn cao gần hết màn. `DataTable` dành cho bảng hiển thị nên không dùng ở đây.
 */
export function PoLinesEditor({
  w,
  expanded,
  onRemove,
}: {
  w: CreatePoWizard;
  expanded: boolean;
  onRemove: (index: number) => void;
}) {
  return (
    <div
      className={cn(
        "border-border-default overflow-auto rounded-[var(--section-radius)] border",
        expanded ? "max-h-[calc(100svh-17rem)]" : "max-h-[min(60vh,560px)]",
      )}
    >
      <table className="w-full min-w-[760px] table-fixed border-collapse">
        <caption className="sr-only">{UI_LABELS.purchaseOrder.linesStep.caption}</caption>
        <colgroup>
          <col className="w-9" />
          <col />
          <col className="w-[96px]" />
          <col className="w-[132px]" />
          <col className="w-[80px]" />
          <col className="w-[132px]" />
          <col className="w-[76px]" />
        </colgroup>
        <thead className="bg-bg-subtle sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--table-line)]">
          <tr>
            <th scope="col" className={cn(TH, "text-right")}>
              {COL.index}
            </th>
            <th scope="col" className={TH}>
              {COL.sku} <span className="text-danger">*</span>
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              {COL.qty} <span className="text-danger">*</span>
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              {COL.price}
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              {COL.tax}
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              {COL.total}
            </th>
            <th scope="col" className={TH}>
              <span className="sr-only">{COL.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-bg-surface">
          {w.lines.fields.map((field, index) => (
            <PoLineRow key={field.id} w={w} index={index} onRemove={() => onRemove(index)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
