import { CYCLE_COUNT_LINE_STATE } from "@/constants/cycle-count";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import type { CycleCountLine } from "./cycle-count-types";

type LineState = (typeof CYCLE_COUNT_LINE_STATE)[keyof typeof CYCLE_COUNT_LINE_STATE];

export type LineVariance = "shortage" | "surplus" | "none";

/** Kết quả đếm của một dòng: chưa đếm (`found` vắng), thùng có mặt, hoặc không thấy. */
export function lineState(line: CycleCountLine): LineState {
  if (line.found === true) return CYCLE_COUNT_LINE_STATE.PRESENT;
  if (line.found === false) return CYCLE_COUNT_LINE_STATE.MISSING;
  return CYCLE_COUNT_LINE_STATE.PENDING;
}

export function countProgress(lines: readonly CycleCountLine[]) {
  return { counted: lines.filter((line) => line.found != null).length, total: lines.length };
}

// Docs 20 §4.2 c7: nộp khi mọi dòng đã đếm; một phiếu không có dòng nào thì chưa có gì để nộp.
export function isFullyCounted(lines: readonly CycleCountLine[]): boolean {
  return lines.length > 0 && lines.every((line) => line.found != null);
}

/**
 * Chênh lệch của dòng: sổ có thùng mà không thấy = thiếu; sổ không có mà thấy (thùng `Lost` tìm lại) = thừa
 * (docs 20 §4.2 c8). `null` khi người đếm không được thấy sổ (kiểm mù, BR-07) hoặc dòng chưa đếm —
 * không bao giờ suy từ chỗ khác.
 */
export function lineVariance(line: CycleCountLine): LineVariance | null {
  if (line.booked == null || line.found == null) return null;
  if (line.booked && !line.found) return "shortage";
  if (!line.booked && line.found) return "surplus";
  return "none";
}

export function showsBooks(lines: readonly CycleCountLine[]): boolean {
  return lines.some((line) => line.booked != null);
}

/**
 * Dòng đếm lại được (docs 20 §4.2 d11): điều chỉnh của dòng bị từ chối, không còn khoản nào chờ duyệt, và dòng chưa
 * được gửi đi đếm lại (`recountRequired`) — BE từ chối các dòng còn lại.
 */
export function recountableLines(lines: readonly CycleCountLine[]): CycleCountLine[] {
  return lines.filter((line) => {
    const statuses = (line.adjustments ?? []).map((adjustment) => adjustment.status);
    return (
      !line.recountRequired &&
      statuses.includes(STOCK_ADJUSTMENT_STATUS.REJECTED) &&
      !statuses.includes(STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL)
    );
  });
}

export type CartonScan =
  | { kind: "present"; line: CycleCountLine }
  | { kind: "wrong-location"; line: CycleCountLine }
  | { kind: "unexpected" };

/**
 * Một lần quét LPN khi đang đứng ở `location` (docs 20 §4.2 b4–b5): thùng có trên phiếu tại đúng vị trí → có mặt;
 * thùng có trên phiếu nhưng ở vị trí khác → báo, không tự đếm (lệch vị trí do quản lý kho xử lý); thùng không có
 * trên phiếu → thêm dòng ngoài kế hoạch tại vị trí đang đứng.
 */
export function classifyCartonScan(
  lines: readonly CycleCountLine[],
  lpn: string,
  location: string,
): CartonScan {
  const wanted = lpn.trim().toUpperCase();
  const here = location.trim().toUpperCase();
  const line = lines.find((candidate) => candidate.lpn?.toUpperCase() === wanted);
  if (!line) return { kind: "unexpected" };
  return line.locationCode.toUpperCase() === here
    ? { kind: "present", line }
    : { kind: "wrong-location", line };
}
