/**
 * Bảng "số kiện đã xếp theo xe": mỗi dòng là một mặt hàng × kích thước danh định, mỗi cột là một xe.
 * (Gốc: phần dựng `loadTable` trong `loading-tables.tsx`.)
 *
 * Dòng = (mã, tên, kích thước DANH ĐỊNH đã sắp). Có kích thước trong khoá nên cùng mã hai cỡ thùng
 * là HAI dòng (gốc từng gộp một, giấu mất một cỡ và cộng sai); kiện xoay vẫn cùng dòng vì bộ ba
 * cạnh đã sắp không đổi.
 */

import type { DimsMm, Layout, UnplacedLine } from "../types";

export interface ItemRow {
  key: string;
  label: string;
  partName: string;
  /** Kích thước danh định của dòng (lấy từ kiện đầu tiên gặp). */
  origMm: DimsMm;
  /** Số kiện đã xếp theo số thứ tự xe. */
  perVehicle: Readonly<Record<number, number>>;
  loaded: number;
  /** Số kiện yêu cầu = đã xếp + chưa xếp được. */
  total: number;
}

export interface ItemTable {
  rows: ItemRow[];
  grandTotal: number;
}

export function itemKey(item: { label: string; partName: string; origMm: DimsMm }): string {
  const sides = [item.origMm.l, item.origMm.w, item.origMm.h].sort((a, b) => a - b);
  return `${item.label}|${item.partName}|${sides.join("|")}`;
}

export function buildItemTable(
  layouts: readonly Layout[],
  unplaced: readonly UnplacedLine[] = [],
): ItemTable {
  const byKey = new Map<string, ItemRow & { perVehicle: Record<number, number> }>();
  const ensure = (item: { label: string; partName: string; origMm: DimsMm }) => {
    const key = itemKey(item);
    let row = byKey.get(key);
    if (!row) {
      row = {
        key,
        label: item.label,
        partName: item.partName,
        origMm: item.origMm,
        perVehicle: {},
        loaded: 0,
        total: 0,
      };
      byKey.set(key, row);
    }
    return row;
  };
  for (const layout of layouts) {
    for (const box of layout.boxes) {
      const row = ensure(box);
      row.perVehicle[layout.seq] = (row.perVehicle[layout.seq] ?? 0) + 1;
      row.loaded += 1;
      row.total += 1;
    }
  }
  // Dòng chỉ có hàng chưa xếp vẫn phải hiện đúng tên/cỡ, không biến mất khỏi bảng.
  for (const line of unplaced) ensure(line).total += line.quantity;
  const rows = [...byKey.values()];
  return { rows, grandTotal: rows.reduce((sum, row) => sum + row.total, 0) };
}
