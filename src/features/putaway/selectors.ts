/**
 * Hàm thuần của màn cất hàng — lọc chữ phía FE (BE không có tìm kiếm), định dạng sức chứa còn trống.
 */

import { PUTAWAY_TASK_STATUS } from "@/constants";
import { formatDecimal } from "@/lib/format/number";

import type { PutawayTask } from "./types";

export interface PutawayTextFilters {
  /** Tìm kiếm chính: LPN, SKU, lô, vị trí đang ở. */
  q: string;
}

const needle = (value: string) => value.trim().toLocaleLowerCase("vi");

/** Ô lọc trống → khớp mọi dòng; không thì một trong các trường chứa chuỗi lọc (không phân biệt hoa thường). */
function matches(filter: string, ...fields: (string | null | undefined)[]): boolean {
  const n = needle(filter);
  return !n || fields.some((field) => field?.toLocaleLowerCase("vi").includes(n));
}

export function filterPutawayTasks(
  rows: readonly PutawayTask[],
  filters: PutawayTextFilters,
): PutawayTask[] {
  return rows.filter((row) =>
    matches(filters.q, row.lpn, row.sku, row.lotNumber, row.sourceLocationCode),
  );
}

/**
 * Thứ tự mặc định: theo LPN (BE trả theo id kỹ thuật — vô nghĩa với người dùng); bấm tiêu đề cột để sắp kiểu khác.
 */
export function sortByLpn(rows: readonly PutawayTask[]): PutawayTask[] {
  return [...rows].sort((a, b) => (a.lpn ?? "").localeCompare(b.lpn ?? "", "vi"));
}

/**
 * Thùng chờ cất kế tiếp sau thùng vừa cất (theo thứ tự LPN như danh sách) và số thùng còn chờ — cho nút "Cất thùng tiếp
 * theo (còn N)". Mỗi thùng vẫn cất riêng, quét riêng (docs 05 BR-08): đây chỉ là lối đi tiếp, không cất hàng loạt.
 */
export function nextPendingTask(
  rows: readonly PutawayTask[],
  currentId: string,
): { task: PutawayTask | null; remaining: number } {
  const pending = sortByLpn(
    rows.filter((row) => row.status === PUTAWAY_TASK_STATUS.PENDING && row.id !== currentId),
  );
  return { task: pending[0] ?? null, remaining: pending.length };
}

/** Có ô lọc chữ nào đang bật (search chính hoặc trong cột). */
export function hasTextFilter(filters: PutawayTextFilters): boolean {
  return filters.q.trim() !== "";
}

/** Thể tích trống (m³) — tối đa 3 chữ số lẻ; null = không giới hạn (tầng chưa có chiều cao, docs 05 BR-03). */
export function freeVolumeText(value: number | null | undefined): string | null {
  return value == null ? null : formatDecimal(value, 3);
}

/** Tải còn lại (kg) — tối đa 1 chữ số lẻ; null = bin không giới hạn tải. */
export function freeWeightText(value: number | null | undefined): string | null {
  return value == null ? null : formatDecimal(value, 1);
}
