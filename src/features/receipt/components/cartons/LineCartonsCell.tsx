"use client";

import { useState } from "react";

import { RECEIPT_CARTON_LABELS as L } from "@/constants";
import { cartonUnitOptions } from "@/features/receipt/carton-selectors";

import { LineCartonsPanel } from "./LineCartonsPanel";

import type { ReceiptLineDto } from "@/features/receipt/types";

const LINK =
  "text-accent focus-visible:ring-border-strong rounded-[var(--r-sm)] font-medium tabular-nums hover:underline focus-visible:ring-2 focus-visible:outline-none";

/**
 * Ô "Thùng / Lẻ" của bảng dòng nhận: số thùng + hàng lẻ, bấm mở panel thùng (in / in lại nhãn). Dòng không có thùng
 * hiện "—" (toàn bộ là hàng lẻ); trên phiếu nháp, dòng có đơn vị đóng gói thì hiện lối "Chia thùng" mở form kiểm đếm.
 */
export function LineCartonsCell({
  line,
  lineNo,
  onSplit,
}: {
  line: ReceiptLineDto;
  lineNo: number;
  /** Phiếu nháp, mở được form kiểm đếm → dòng chưa có thùng có nút chia thùng. */
  onSplit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (line.packages.length === 0) {
    return onSplit && cartonUnitOptions(line).length > 0 ? (
      <td className="px-3 py-2 whitespace-nowrap">
        <button type="button" aria-label={L.splitLine(lineNo)} onClick={onSplit} className={LINK}>
          {L.splitAction}
        </button>
      </td>
    ) : (
      <td className="text-ink-tertiary px-3 py-2 whitespace-nowrap">—</td>
    );
  }
  return (
    <td className="px-3 py-2 whitespace-nowrap">
      <button
        type="button"
        aria-label={L.openCartons(line.sku ?? "")}
        onClick={() => setOpen(true)}
        className={LINK}
      >
        {L.cellSummary(line.packages.length, line.looseQuantity)}
      </button>
      {open && <LineCartonsPanel line={line} open onClose={() => setOpen(false)} />}
    </td>
  );
}
