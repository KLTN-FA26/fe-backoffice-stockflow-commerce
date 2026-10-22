/** Số liệu và gom nhóm thuần cho màn soạn: dòng khay, kiện cùng loại / cùng bộ, số liệu xe, dòng mặt hàng. */

import { weightOf } from "./parcels";

import type { DimsMm, LayoutBox } from "../types";
import type { EditVehicle, TrayParcel } from "./types";

/** Khoá kích thước KHÔNG phụ thuộc hướng xoay (ba cạnh đã sắp) — một cỡ ở hướng nào cũng là một dòng (gốc `sizeKey`). */
export const sizeKey = (dims: DimsMm): string =>
  [dims.l, dims.w, dims.h]
    .map(Math.round)
    .sort((a, b) => a - b)
    .join("x");

export interface TrayLine {
  key: string;
  partName: string;
  /** Kiện cùng tên + cỡ + cờ xoay + bộ; kiện đầu tiên là kiện sẽ được đặt khi bấm ô gợi ý. */
  parcels: readonly TrayParcel[];
}

/**
 * Gom khay thành dòng. Khoá có cả mã bộ: hai bộ bàn khác nhau không gộp, để người soạn chọn đúng bộ cần đặt cạnh nhau
 * (LP-3 — một bộ đi cùng một xe).
 */
export function trayLines(tray: readonly TrayParcel[]): TrayLine[] {
  const lines = new Map<string, TrayParcel[]>();
  for (const parcel of tray) {
    const key = [
      parcel.partName,
      sizeKey(parcel.origMm),
      parcel.rotatable ? "r" : "f",
      parcel.kitGroup ?? "",
    ].join("|");
    lines.set(key, [...(lines.get(key) ?? []), parcel]);
  }
  return [...lines].map(([key, parcels]) => ({ key, partName: parcels[0].partName, parcels }));
}

const sameKind = (a: LayoutBox, b: LayoutBox): boolean =>
  a.partName === b.partName &&
  sizeKey(a.origMm) === sizeKey(b.origMm) &&
  a.wMm === b.wMm &&
  a.hMm === b.hMm &&
  a.dMm === b.dMm;

/** Mọi kiện trên xe cùng loại (tên, cỡ, hướng đặt) với kiện `ref` — để xoay / chuyển cả loạt. */
export function peerRefs(vehicle: EditVehicle, ref: string): string[] {
  const anchor = vehicle.boxes.find((box) => box.ref === ref);
  return anchor ? vehicle.boxes.filter((box) => sameKind(box, anchor)).map((box) => box.ref) : [];
}

/** Mọi kiện trên xe cùng bộ với kiện `ref` (rỗng nếu không thuộc bộ). */
export function kitRefs(vehicle: EditVehicle, ref: string): string[] {
  const group = vehicle.boxes.find((box) => box.ref === ref)?.kitGroup;
  return group ? vehicle.boxes.filter((box) => box.kitGroup === group).map((box) => box.ref) : [];
}

export interface VehicleStats {
  count: number;
  weightKg: number;
  weightPct: number;
  volumePct: number;
}

export function vehicleStats(vehicle: EditVehicle): VehicleStats {
  const weightKg = weightOf(vehicle.boxes);
  const volume = vehicle.boxes.reduce((sum, box) => sum + box.wMm * box.hMm * box.dMm, 0);
  const capacity = vehicle.innerMm.l * vehicle.innerMm.w * vehicle.innerMm.h;
  return {
    count: vehicle.boxes.length,
    weightKg,
    weightPct: vehicle.maxPayloadKg > 0 ? weightKg / vehicle.maxPayloadKg : 0,
    volumePct: capacity > 0 ? volume / capacity : 0,
  };
}

export interface ProductRow {
  key: string;
  partName: string;
  dims: DimsMm;
  refs: readonly string[];
}

/** Mặt hàng trên xe (cùng tên + cỡ danh định, bất kể hướng) — bảng "→ Khay" của gốc. */
export function productRows(vehicle: EditVehicle): ProductRow[] {
  const rows = new Map<string, ProductRow>();
  for (const box of vehicle.boxes) {
    const key = `${box.partName}|${sizeKey(box.origMm)}`;
    const row = rows.get(key);
    if (row) rows.set(key, { ...row, refs: [...row.refs, box.ref] });
    else rows.set(key, { key, partName: box.partName, dims: box.origMm, refs: [box.ref] });
  }
  return [...rows.values()];
}
