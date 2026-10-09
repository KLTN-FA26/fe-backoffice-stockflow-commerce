import { formatDateTime } from "@/lib/format/date";

import type { ReceiptLineDto } from "@/features/receipt/types";

/**
 * Ô vị trí của dòng nhận. Phiếu nháp: vị trí nhận (RECEIVING). Đã xác nhận: vị trí hiện tại —
 * khu QC nếu đã chuyển (`qcLocationCode`), kèm thời điểm chuyển và khu nhận ban đầu.
 */
export function LineLocationCell({ line, draft }: { line: ReceiptLineDto; draft: boolean }) {
  const current = draft ? line.locationCode : (line.qcLocationCode ?? line.locationCode);
  return (
    <td className="px-3 py-2">
      <div className="font-[family-name:var(--font-mono)]">{current ?? "—"}</div>
      {!draft && line.movedToQcAt && (
        <div className="text-ink-tertiary text-xs whitespace-nowrap">
          Chuyển QC <span className="tabular-nums">{formatDateTime(line.movedToQcAt)}</span>
          {line.locationCode && (
            <>
              {" "}
              · từ <span className="font-[family-name:var(--font-mono)]">{line.locationCode}</span>
            </>
          )}
        </div>
      )}
    </td>
  );
}
