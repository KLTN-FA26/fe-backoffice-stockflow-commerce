/**
 * Shipping — selector thuần: đối soát kế hoạch xếp xe với kiện đã quét (docs 09 §4 bước 4).
 */

import type { Load, LoadLine } from "./types";

export interface LoadReconciliation {
  planned: number;
  loaded: number;
  loadedLines: LoadLine[];
  missingLines: LoadLine[];
  /** 0..100, làm tròn xuống — 100 chỉ khi đủ kiện. */
  progress: number;
  totalWeightKg: number;
}

export function isLineLoaded(line: LoadLine): boolean {
  return !!line.loadedAt;
}

export function reconcileLoad(load: Pick<Load, "lines">): LoadReconciliation {
  const loadedLines = load.lines
    .filter(isLineLoaded)
    // Kiện quét gần nhất lên đầu — người quét thấy ngay kết quả
    // So theo thời điểm, không so chuỗi: BE / mock có thể trả lẫn "+07:00" và "Z"
    .sort((a, b) => Date.parse(b.loadedAt ?? "") - Date.parse(a.loadedAt ?? ""));
  const missingLines = load.lines.filter((line) => !isLineLoaded(line));
  const planned = load.lines.length;
  const loaded = loadedLines.length;
  return {
    planned,
    loaded,
    loadedLines,
    missingLines,
    progress: planned === 0 ? 0 : Math.floor((loaded / planned) * 100),
    totalWeightKg: load.lines.reduce((sum, line) => sum + (line.weightKg ?? 0), 0),
  };
}

/** Số đơn hàng khác nhau trên chuyến (biên bản bàn giao). */
export function orderCount(load: Pick<Load, "lines">): number {
  return new Set(load.lines.map((line) => line.orderId)).size;
}
