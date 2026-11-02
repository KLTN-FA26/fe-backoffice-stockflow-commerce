"use client";

import { UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";

const S = UI_LABELS.warehouseMap.map.scene;

/**
 * Nhãn góc trái-dưới cảnh toàn cảnh khi thùng hàng KHÔNG phản ánh đủ tồn: kho lớn hơn trần đọc (chỉ
 * vẽ một phần) hoặc đọc tồn lỗi (không vẽ thùng). Không im lặng — người xem phải biết (BR-05).
 */
export function StockNotice({
  partial,
  failed,
}: {
  partial: { shown: number; total: number } | null;
  failed: boolean;
}) {
  if (!partial && !failed) return null;
  return (
    <p
      role="status"
      className="bg-bg-surface border-border-default text-ink-secondary absolute bottom-3 left-3 rounded-(--card-radius) border px-2.5 py-1.5 text-xs shadow-(--sh-sm)"
    >
      {failed
        ? S.overviewStockFailed
        : partial &&
          S.overviewStockPartial(formatNumber(partial.shown), formatNumber(partial.total))}
    </p>
  );
}
