/**
 * Khoảng trống cực đại (EMS) và ô gợi ý chỗ đặt cho trình soạn xếp tay (PR F5).
 * (Gốc: nửa sau của `nesting-report/manual-packing.ts`.)
 *
 * Mỗi khoảng trống là một hộp còn rỗng sau các kiện đã xếp — dùng làm mục tiêu bấm để đặt, và là
 * lớp phủ "xem chỗ trống" của khung 3D.
 */

import { LAYOUT_ORIENTATIONS, LOAD_PLANNING_LIMITS } from "@/constants";

import { orientedExtent, passesDoor } from "./dims";
import { intersects, restingY, validatePlacement } from "./manual-packing";

import type { LayoutOrientation } from "@/constants";
import type { BlockMm, DimsMm, DoorMm, ExtentMm } from "../types";

const EPS = LOAD_PLANNING_LIMITS.geometryEpsilonMm;

export type Space = BlockMm & { id: string };
type RawSpace = BlockMm;

export interface Orientation extends ExtentMm {
  orientation: LayoutOrientation;
}

/** Mọi hướng đặt khác nhau của một kiện (tối đa 6; thùng có hai cạnh bằng nhau gộp lại). */
export function orientationsOf(orig: DimsMm, rotatable: boolean): Orientation[] {
  const candidates = rotatable ? LAYOUT_ORIENTATIONS : (["LWH"] as const);
  const seen = new Set<string>();
  const out: Orientation[] = [];
  for (const orientation of candidates) {
    const extent = orientedExtent(orig, orientation);
    const key = `${extent.wMm}|${extent.hMm}|${extent.dMm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ orientation, ...extent });
  }
  return out;
}

function contained(inner: RawSpace, outer: RawSpace): boolean {
  return (
    inner.xMm >= outer.xMm - EPS &&
    inner.yMm >= outer.yMm - EPS &&
    inner.zMm >= outer.zMm - EPS &&
    inner.xMm + inner.wMm <= outer.xMm + outer.wMm + EPS &&
    inner.yMm + inner.hMm <= outer.yMm + outer.hMm + EPS &&
    inner.zMm + inner.dMm <= outer.zMm + outer.dMm + EPS
  );
}

const volume = (s: RawSpace): number => s.wMm * s.hMm * s.dMm;

/** Chỉ giữ khoảng trống cực đại: sắp theo thể tích giảm dần, bỏ cái nằm trọn trong cái đã giữ. */
function pruneContained(list: readonly RawSpace[]): RawSpace[] {
  const kept: RawSpace[] = [];
  for (const space of [...list].sort((a, b) => volume(b) - volume(a))) {
    if (!kept.some((k) => contained(space, k))) kept.push(space);
  }
  return kept;
}

/** Cắt một khoảng trống quanh một kiện thành tối đa 6 khoảng con (trái/phải, dưới/trên, trước/sau). */
function splitAround(s: RawSpace, p: BlockMm): RawSpace[] {
  const px1 = p.xMm + p.wMm;
  const py1 = p.yMm + p.hMm;
  const pz1 = p.zMm + p.dMm;
  return [
    { ...s, wMm: p.xMm - s.xMm },
    { ...s, xMm: px1, wMm: s.xMm + s.wMm - px1 },
    { ...s, hMm: p.yMm - s.yMm },
    { ...s, yMm: py1, hMm: s.yMm + s.hMm - py1 },
    { ...s, dMm: p.zMm - s.zMm },
    { ...s, zMm: pz1, dMm: s.zMm + s.dMm - pz1 },
  ];
}

/**
 * Bắt đầu từ cả lòng xe, cắt mọi khoảng trống giao với một kiện. Phải tỉa trùng/mảnh SAU MỖI kiện —
 * không tỉa thì danh sách phình gần như cấp mũ (≈90 kiện từng treo giao diện).
 */
export function computeEmptySpaces(
  extent: ExtentMm,
  placements: readonly BlockMm[],
  minDimMm: number = LOAD_PLANNING_LIMITS.minEmptySpaceMm,
): Space[] {
  let spaces: RawSpace[] = [{ xMm: 0, yMm: 0, zMm: 0, ...extent }];
  for (const placed of placements) {
    const next: RawSpace[] = [];
    for (const space of spaces) {
      if (!intersects(space, placed)) {
        next.push(space);
        continue;
      }
      // Mảnh nhỏ hơn minDim không bao giờ chứa nổi thùng (khoảng trống chỉ co lại) nên bỏ ngay.
      for (const part of splitAround(space, placed)) {
        if (part.wMm >= minDimMm && part.hMm >= minDimMm && part.dMm >= minDimMm) next.push(part);
      }
    }
    spaces = pruneContained(next).slice(0, LOAD_PLANNING_LIMITS.emptySpacesMax);
  }
  return spaces.map((s, i) => ({
    ...s,
    id: `sp${i}-${Math.round(s.xMm)}-${Math.round(s.yMm)}-${Math.round(s.zMm)}`,
  }));
}

const fitsIn = (o: ExtentMm, space: BlockMm): boolean =>
  o.wMm <= space.wMm + EPS && o.hMm <= space.hMm + EPS && o.dMm <= space.dMm + EPS;

/**
 * Các hướng đặt vừa trong khoảng trống, tốt nhất trước (thấp nhất, rồi đáy nhỏ nhất — như solver). `door`: bỏ các
 * hướng có mặt hướng ra cửa (rộng × cao) lớn hơn cửa xe (LP3-DOOR); không truyền = không giới hạn.
 */
export function fittingOrientations(
  space: BlockMm,
  orig: DimsMm,
  rotatable: boolean,
  door?: DoorMm | null,
): Orientation[] {
  return orientationsOf(orig, rotatable)
    .filter((o) => fitsIn(o, space) && passesDoor(o, door))
    .sort((a, b) => a.hMm - b.hMm || a.wMm * a.dMm - b.wMm * b.dMm);
}

/** Ô xem trước chỗ rơi thật (sau trọng lực) của thùng đang chọn. */
export interface LandingGhost extends BlockMm {
  id: string;
  orientation: LayoutOrientation;
  supportRatio: number;
}

export interface LandingOptions {
  /** Khoảng trống đã tính sẵn (vd từ web worker) — không truyền thì tính tại chỗ (chậm trên xe nhiều kiện). */
  spaces?: readonly BlockMm[];
  /** Chỉ gợi ý một hướng đặt (người dùng đã chọn); không truyền = hướng tốt nhất của từng khoảng trống. */
  orientation?: LayoutOrientation;
  door?: DoorMm | null;
}

/**
 * Với mỗi khoảng trống thùng vừa: thả thùng xuống (trọng lực) và phát một ô gợi ý đúng cỡ thùng ở
 * chỗ nó nằm lại — bỏ trùng, và LOẠI ô vi phạm luật (kể cả thiếu đỡ, khác bản gốc chỉ cảnh báo).
 */
export function computeLandingGhosts(
  extent: ExtentMm,
  placements: readonly BlockMm[],
  box: { origMm: DimsMm; rotatable: boolean },
  options: LandingOptions = {},
): LandingGhost[] {
  const { orientation, door } = options;
  const chosen: Orientation | null = orientation
    ? { orientation, ...orientedExtent(box.origMm, orientation) }
    : null;
  if (chosen && !box.rotatable && orientation !== "LWH") return [];
  const out: LandingGhost[] = [];
  const seen = new Set<string>();
  for (const space of options.spaces ?? computeEmptySpaces(extent, placements)) {
    const best = chosen ?? fittingOrientations(space, box.origMm, box.rotatable, door)[0];
    if (!best || !fitsIn(best, space) || !passesDoor(best, door)) continue;
    const yMm = restingY(
      { xMm: space.xMm, zMm: space.zMm, wMm: best.wMm, dMm: best.dMm },
      space.yMm,
      placements,
    );
    const candidate: BlockMm = {
      xMm: space.xMm,
      yMm,
      zMm: space.zMm,
      wMm: best.wMm,
      hMm: best.hMm,
      dMm: best.dMm,
    };
    const check = validatePlacement(candidate, extent, placements);
    if (!check.ok) continue;
    const id = `${Math.round(candidate.xMm)}|${Math.round(yMm)}|${Math.round(candidate.zMm)}|${best.wMm}|${best.hMm}|${best.dMm}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...candidate, id, orientation: best.orientation, supportRatio: check.supportRatio });
  }
  // Chỗ thấp trước (sàn là chỗ người xếp với tới), rồi giới hạn số lượng — hàng trăm mesh làm chậm khung 3D.
  out.sort((a, b) => a.yMm - b.yMm || a.xMm - b.xMm || a.zMm - b.zMm);
  return out.slice(0, LOAD_PLANNING_LIMITS.landingGhostsMax);
}
