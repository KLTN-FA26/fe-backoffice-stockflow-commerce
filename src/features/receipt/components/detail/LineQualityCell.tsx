"use client";

import { useState } from "react";

import { inspectionTotals, lineQualityStatuses } from "@/features/receipt/selectors";
import { StatusDot } from "@/components/shared/StatusDot";

import { LineQcPanel } from "./LineQcPanel";

import type { ReceiptLineDto } from "@/features/receipt/types";

/**
 * Trạng thái chất lượng (docs 03 §5.2) + tóm tắt kết luận QC của một dòng. Chi tiết (khu, lý do,
 * thời điểm, người QC) mở trong panel bên phải để bảng không phình theo lý do dài.
 */
export function LineQualityCell({ line }: { line: ReceiptLineDto }) {
  const [open, setOpen] = useState(false);
  const totals = inspectionTotals(line);
  const summary = [
    totals.accepted ? `Đạt ${totals.accepted}` : null,
    totals.quarantined ? `Cách ly ${totals.quarantined}` : null,
    totals.rejected ? `Không đạt ${totals.rejected}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // Có gì để xem: đã chuyển sang khu QC hoặc đã kết luận (dòng 2 bước không có QC)
  const hasDetail = !!line.movedToQcAt || line.inspections.length > 0;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {lineQualityStatuses(line).map((status) => (
          <StatusDot key={status} domain="qc" status={status} withIcon />
        ))}
      </div>
      {hasDetail && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
          {summary && <span className="text-ink-tertiary tabular-nums">{summary}</span>}
          <button
            type="button"
            onClick={() => setOpen(true)}
            // Kèm lô: một dòng PO tách nhiều lô → nhiều nút cùng SKU, nhãn phải phân biệt được
            aria-label={`Xem chi tiết QC dòng ${line.sku ?? ""}${line.lotNumber ? ` lô ${line.lotNumber}` : ""}`}
            className="text-accent focus-visible:ring-border-strong rounded-[var(--r-sm)] font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Xem QC →
          </button>
        </div>
      )}
      {hasDetail && <LineQcPanel line={line} open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
