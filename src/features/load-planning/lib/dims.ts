/**
 * Kích thước hiển thị cho người xem + đổi giữa hệ trục solver và thứ tự trên phiếu.
 *
 * Solver làm việc theo rộng (x), cao (y), dài (z); phiếu xếp hàng ghi D×R×C = dài × rộng × cao,
 * tức z × x × y. Hàm ở đây CHỈ để hiển thị — không bao giờ ghi ngược vào toạ độ/kích thước lưu.
 * (Gốc: `lib/nesting-dims.ts`.)
 */

import { formatNumber } from "@/lib/format";

import type { LayoutOrientation } from "@/constants";
import type { DimsMm, ExtentMm, LayoutBox } from "../types";

const MM3_PER_M3 = 1_000_000_000;

/** "D×R×C" từ ba cạnh theo trục (dài = z, rộng = x, cao = y). */
export function formatLWH(extent: ExtentMm, unit = "mm"): string {
  return `${extent.dMm}×${extent.wMm}×${extent.hMm}${unit}`;
}

export function mmToCm(mm: number): string {
  return formatNumber(Math.round(mm) / 10);
}

/** "D×R×C" cm từ kích thước danh định `{l,w,h}` (mm). */
export function formatNominalCm(dims: DimsMm): string {
  return `${mmToCm(dims.l)}×${mmToCm(dims.w)}×${mmToCm(dims.h)}`;
}

/** Lòng xe `{l,w,h}` → ba cạnh theo trục (rộng = w, cao = h, dài = l). */
export function extentOf(inner: DimsMm): ExtentMm {
  return { wMm: inner.w, hMm: inner.h, dMm: inner.l };
}

/**
 * Kích thước theo trục của kiện khi đặt theo `orientation`. Chữ thứ nhất là cạnh dọc trục z,
 * thứ hai dọc x, thứ ba dọc y (xem `LAYOUT_ORIENTATIONS`).
 */
export function orientedExtent(orig: DimsMm, orientation: LayoutOrientation): ExtentMm {
  const [alongZ, alongX, alongY] = orientation.split("") as Array<"L" | "W" | "H">;
  const pick = (axis: "L" | "W" | "H"): number =>
    axis === "L" ? orig.l : axis === "W" ? orig.w : orig.h;
  return { dMm: pick(alongZ), wMm: pick(alongX), hMm: pick(alongY) };
}

export function volumeMm3(extent: ExtentMm): number {
  return extent.wMm * extent.hMm * extent.dMm;
}

/** Kích thước đã xếp của kiện có khớp kích thước danh định theo hướng đặt (lệch ≤ dung sai do làm tròn)? */
export function matchesOrientation(box: LayoutBox, toleranceMm = 1): boolean {
  const expected = orientedExtent(box.origMm, box.orientation);
  return (
    Math.abs(expected.wMm - box.wMm) <= toleranceMm &&
    Math.abs(expected.hMm - box.hMm) <= toleranceMm &&
    Math.abs(expected.dMm - box.dMm) <= toleranceMm
  );
}

export function formatM3(mm3: number): string {
  const m3 = mm3 / MM3_PER_M3;
  return `${m3.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`;
}
