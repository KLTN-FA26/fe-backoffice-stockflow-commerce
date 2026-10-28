/** Chuyển một kiện giữa hai dạng: đã đặt (`LayoutBox`) và ở khay (`TrayParcel`), cùng tra cứu theo `ref`. */

import type { PlanParcel } from "../plan-types";
import type { LayoutBox } from "../types";
import type { EditorState, Placement, TrayParcel } from "./types";

export function toTrayParcel(box: TrayParcel): TrayParcel {
  return {
    ref: box.ref,
    sourceRef: box.sourceRef,
    label: box.label,
    partName: box.partName,
    kitGroup: box.kitGroup,
    origMm: box.origMm,
    rotatable: box.rotatable,
    weightKg: box.weightKg,
  };
}

export function toPlacedBox(parcel: TrayParcel, placement: Placement): LayoutBox {
  return { ...toTrayParcel(parcel), ...placement };
}

/** Kiện của kế hoạch (BE `ParcelView`) ở dạng khay. */
export function trayParcelOf(parcel: PlanParcel): TrayParcel {
  return {
    ref: parcel.packageId,
    sourceRef: null,
    label: parcel.labelCode,
    partName: parcel.partName,
    kitGroup: parcel.kitGroupId ?? null,
    origMm: { l: parcel.lengthMm, w: parcel.widthMm, h: parcel.heightMm },
    rotatable: parcel.rotatable,
    weightKg: parcel.weightKg,
  };
}

export const placementOf = (box: LayoutBox): Placement => ({
  xMm: box.xMm,
  yMm: box.yMm,
  zMm: box.zMm,
  wMm: box.wMm,
  hMm: box.hMm,
  dMm: box.dMm,
  orientation: box.orientation,
});

export interface Located {
  parcel: TrayParcel;
  /** Xe đang chứa kiện; null = ở khay. */
  seq: number | null;
  box: LayoutBox | null;
}

const indexes = new WeakMap<EditorState, ReadonlyMap<string, Located>>();

/** Mọi kiện theo `ref` (cache theo trạng thái; trạng thái bất biến). */
export function indexParcels(state: EditorState): ReadonlyMap<string, Located> {
  const cached = indexes.get(state);
  if (cached) return cached;
  const map = new Map<string, Located>();
  for (const vehicle of state.vehicles)
    for (const box of vehicle.boxes) map.set(box.ref, { parcel: box, seq: vehicle.seq, box });
  for (const parcel of state.tray) map.set(parcel.ref, { parcel, seq: null, box: null });
  indexes.set(state, map);
  return map;
}

export const weightOf = (boxes: readonly Pick<LayoutBox, "weightKg">[]): number =>
  boxes.reduce((sum, box) => sum + box.weightKg, 0);
