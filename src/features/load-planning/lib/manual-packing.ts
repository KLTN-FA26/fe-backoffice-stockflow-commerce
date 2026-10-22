/**
 * Hình học xếp tay (Cube-IQ) — hàm thuần cho trình soạn kế hoạch (PR F5).
 *
 * Toạ độ khớp solver BE: gốc ở góc sàn trong sát vách đầu xe, mm, y hướng lên. Luật kiểm tra phản
 * chiếu solver: trong lòng xe, không chồng nhau, đáy được đỡ ≥ `minSupportRatio`.
 *
 * KHÁC bản gốc (`nesting-report/manual-packing.ts`): thiếu đỡ là LỖI chặn, không phải cảnh báo.
 * Bản gốc cho đặt tay kiện treo lơ lửng để người dùng tự cân nhắc; kế hoạch xếp xe thật thì kiện
 * thiếu đỡ có thể đổ khi chạy, nên luật này phải chặn cùng mức với bounds và overlap (BE trả
 * `PLACEMENT_RULE_VIOLATION` cho cùng luật). Khối gia cố được truyền vào `others` như vật cản.
 */

import { LOAD_PLANNING_LIMITS } from "@/constants";

import type { BlockMm, ExtentMm } from "../types";

const EPS = LOAD_PLANNING_LIMITS.geometryEpsilonMm;
/** Dưới mức này coi như treo giữa không (gốc 0,02) — khác ngưỡng 98% của luật đỡ. */
const FLOATING_RATIO = 0.02;

type Axis = "x" | "y" | "z";

const lo = (b: BlockMm, axis: Axis): number =>
  axis === "x" ? b.xMm : axis === "y" ? b.yMm : b.zMm;
const size = (b: BlockMm, axis: Axis): number =>
  axis === "x" ? b.wMm : axis === "y" ? b.hMm : b.dMm;
const hi = (b: BlockMm, axis: Axis): number => lo(b, axis) + size(b, axis);

/** Hai khối có phần chung (> dung sai) trên trục này? */
function overlapsOnAxis(a: BlockMm, b: BlockMm, axis: Axis): boolean {
  return lo(a, axis) < hi(b, axis) - EPS && hi(a, axis) > lo(b, axis) + EPS;
}

export function intersects(a: BlockMm, b: BlockMm): boolean {
  return overlapsOnAxis(a, b, "x") && overlapsOnAxis(a, b, "y") && overlapsOnAxis(a, b, "z");
}

/** Khối có giao với bất kỳ khối nào trong `others`? (solver `_overlaps`) */
export function overlapsAny(block: BlockMm, others: readonly BlockMm[]): boolean {
  return others.some((other) => intersects(block, other));
}

/**
 * Tỉ lệ diện tích đáy (rộng × dài) nằm trên sàn hoặc trên mặt phẳng đỉnh các khối khác
 * (solver `_support`). 1 = đỡ đủ.
 */
export function supportRatio(block: BlockMm, others: readonly BlockMm[]): number {
  if (block.yMm <= EPS) return 1;
  const base = block.wMm * block.dMm;
  if (base <= 0) return 1;
  let covered = 0;
  for (const other of others) {
    if (Math.abs(hi(other, "y") - block.yMm) > EPS) continue;
    const overlapX = Math.min(hi(block, "x"), hi(other, "x")) - Math.max(block.xMm, other.xMm);
    const overlapZ = Math.min(hi(block, "z"), hi(other, "z")) - Math.max(block.zMm, other.zMm);
    if (overlapX > EPS && overlapZ > EPS) covered += overlapX * overlapZ;
  }
  return covered / base;
}

/**
 * Trọng lực: độ cao y mà một đáy (rộng × dài) thả từ `ceilYMm` sẽ nằm lại — đỉnh cao nhất dưới
 * đáy (đỉnh ≤ `ceilYMm`), hoặc sàn. Khoảng giữa đỉnh đó và `ceilYMm` chắc chắn trống dưới đáy.
 */
export function restingY(
  footprint: Pick<BlockMm, "xMm" | "zMm" | "wMm" | "dMm">,
  ceilYMm: number,
  others: readonly BlockMm[],
): number {
  let y = 0;
  for (const other of others) {
    const top = hi(other, "y");
    if (top > ceilYMm + EPS || top <= y) continue;
    const under =
      footprint.xMm < hi(other, "x") - EPS &&
      footprint.xMm + footprint.wMm > other.xMm + EPS &&
      footprint.zMm < hi(other, "z") - EPS &&
      footprint.zMm + footprint.dMm > other.zMm + EPS;
    if (under) y = top;
  }
  return y;
}

/**
 * Thả mọi kiện đang lơ lửng (đáy gần như không được đỡ) xuống vật nằm dưới, để kế hoạch lưu không
 * bao giờ có thùng treo. Xử lý từ thấp lên cao; kiện đã tựa vào gì đó giữ nguyên y. Trả về danh sách MỚI.
 */
export function settleFloaters<T extends BlockMm>(
  list: readonly T[],
  obstacles: readonly BlockMm[] = [],
): T[] {
  const order = list
    .map((block, index) => ({ block, index }))
    .sort((a, b) => a.block.yMm - b.block.yMm);
  const out = [...list];
  const settled: BlockMm[] = [...obstacles];
  for (const { block, index } of order) {
    let y = block.yMm;
    if (block.yMm > 0 && supportRatio(block, settled) < FLOATING_RATIO)
      y = restingY(block, block.yMm, settled);
    out[index] = { ...block, yMm: y };
    settled.push(out[index]);
  }
  return out;
}

/**
 * Quãng trượt tự do của khối dọc `axis` theo chiều `dir` trước khi chạm vách xe hoặc khối khác —
 * để nhích tay dừng sát vật cản thay vì hụt một khe nhỏ.
 */
export function maxSlide(
  block: BlockMm,
  axis: Axis,
  dir: -1 | 1,
  extent: ExtentMm,
  others: readonly BlockMm[],
): number {
  const limitAxis: Record<Axis, number> = { x: extent.wMm, y: extent.hMm, z: extent.dMm };
  const otherAxes = (["x", "y", "z"] as const).filter((a) => a !== axis);
  // Vật cản chỉ chặn nếu chồng lên khối ở hai trục còn lại.
  const blocks = (other: BlockMm) => otherAxes.every((a) => overlapsOnAxis(block, other, a));
  if (dir === 1) {
    let limit = limitAxis[axis];
    for (const other of others) {
      if (blocks(other) && lo(other, axis) >= hi(block, axis) - EPS)
        limit = Math.min(limit, lo(other, axis));
    }
    return Math.max(0, limit - hi(block, axis));
  }
  let limit = 0;
  for (const other of others) {
    if (blocks(other) && hi(other, axis) <= lo(block, axis) + EPS)
      limit = Math.max(limit, hi(other, axis));
  }
  return Math.max(0, lo(block, axis) - limit);
}

/** Mã luật, dùng chung tên với `PLACEMENT_RULE_VIOLATION` của BE (design §5). */
export type PlacementRule = "OUT_OF_BOUNDS" | "OVERLAP" | "INSUFFICIENT_SUPPORT";

export interface PlacementCheck {
  violations: PlacementRule[];
  supportRatio: number;
  /** Không vi phạm luật nào (gồm cả luật đỡ). */
  ok: boolean;
}

export function validatePlacement(
  block: BlockMm,
  extent: ExtentMm,
  others: readonly BlockMm[],
): PlacementCheck {
  const inBounds =
    block.xMm >= -EPS &&
    block.yMm >= -EPS &&
    block.zMm >= -EPS &&
    hi(block, "x") <= extent.wMm + EPS &&
    hi(block, "y") <= extent.hMm + EPS &&
    hi(block, "z") <= extent.dMm + EPS;
  const support = supportRatio(block, others);
  const violations: PlacementRule[] = [];
  if (!inBounds) violations.push("OUT_OF_BOUNDS");
  if (overlapsAny(block, others)) violations.push("OVERLAP");
  if (support < LOAD_PLANNING_LIMITS.minSupportRatio) violations.push("INSUFFICIENT_SUPPORT");
  return { violations, supportRatio: support, ok: violations.length === 0 };
}
