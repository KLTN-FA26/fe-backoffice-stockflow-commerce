"use client";

import { useState } from "react";

import { RECEIPT_CARTON_LABELS as L } from "@/constants";

import { LineCartonsPanel } from "./LineCartonsPanel";

import type { ReceiptLineDto } from "@/features/receipt/types";

/**
 * Ô "Thùng / Lẻ" của bảng dòng nhận: số thùng + hàng lẻ, bấm mở panel thùng (in / in lại nhãn). Dòng không có thùng
 * hiện "—" (toàn bộ là hàng lẻ).
 */
export function LineCartonsCell({ line }: { line: ReceiptLineDto }) {
  const [open, setOpen] = useState(false);
  if (line.packages.length === 0) {
    return <td className="text-ink-tertiary px-3 py-2 whitespace-nowrap">—</td>;
  }
  return (
    <td className="px-3 py-2 whitespace-nowrap">
      <button
        type="button"
        aria-label={L.openCartons(line.sku ?? "")}
        onClick={() => setOpen(true)}
        className="text-accent focus-visible:ring-border-strong rounded-[var(--r-sm)] font-medium tabular-nums hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        {L.cellSummary(line.packages.length, line.looseQuantity)}
      </button>
      {open && <LineCartonsPanel line={line} open onClose={() => setOpen(false)} />}
    </td>
  );
}
