/** Ký hiệu chữ, hướng đặt, "Bộ x/N" và số khối lượng trên phiếu xếp hàng (SCRUM-287 PR F6) — hàm thuần, chỉ định dạng. */

import { LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";

import type { LayoutOrientation } from "@/constants";
import type { PlanParcel } from "../plan-types";
import type { LayoutBox } from "../types";

const P = LOAD_PLAN_PRINT_LABELS.parcel;
/** Hướng đặt không xoay: dài dọc xe, rộng ngang xe, cao hướng lên (`LAYOUT_ORIENTATIONS[0]`). */
const UNROTATED: LayoutOrientation = "LWH";

/** A, B, … Z, AA, AB, … — chữ ký hiệu không trùng dù có hơn 26 mặt hàng. */
export function letterFor(index: number): string {
  let letter = "";
  let n = index + 1;
  while (n > 0) {
    const rest = (n - 1) % 26;
    letter = String.fromCharCode(65 + rest) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/** Tên mặt hàng → chữ ký hiệu, theo thứ tự chữ cái như bảng màu (`buildColorMap`). */
export function letterMapOf(boxes: readonly Pick<LayoutBox, "partName">[]): Map<string, string> {
  const names = [...new Set(boxes.map((box) => box.partName))].sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
  return new Map(names.map((name, index) => [name, letterFor(index)]));
}

/** "Giữ nguyên" hoặc cạnh nào (D/R/C) của kiện nằm dọc xe, ngang xe, đứng. */
export function orientationText(orientation: LayoutOrientation): string {
  if (orientation === UNROTATED) return P.asIs;
  const [along, across, up] = orientation
    .split("")
    .map((axis) => P.axisLetters[axis as keyof typeof P.axisLetters]);
  return P.rotated(along, across, up);
}

export function kitText(parcel: PlanParcel | undefined, box: LayoutBox): string | null {
  if (parcel?.kitPartNo != null && parcel.kitPartCount != null) {
    return P.kitPart(parcel.kitPartNo, parcel.kitPartCount);
  }
  return parcel?.kitGroupId || box.kitGroup ? P.kitOther : null;
}

export const formatKg = (kg: number): string => formatNumber(Math.round(kg * 10) / 10);
