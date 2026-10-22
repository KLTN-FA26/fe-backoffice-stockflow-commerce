/** Phép hình học của từng thao tác soạn trên MỘT xe — hàm thuần, trả danh sách kiện mới hoặc `null`/lý do từ chối. */

import { LOAD_PLANNING_LIMITS } from "@/constants";

import { extentOf, orientedExtent, passesDoor } from "../lib/dims";
import { maxSlide, settleFloaters, validatePlacement } from "../lib/manual-packing";

import type { LayoutOrientation } from "@/constants";
import type { LayoutBox } from "../types";
import type { Axis, EditVehicle, RejectReason } from "./types";

const EPS = LOAD_PLANNING_LIMITS.geometryEpsilonMm;

export type Moved = { ok: true; boxes: LayoutBox[] } | { ok: false; reason: RejectReason };

/**
 * Nhích các kiện đã chọn như MỘT khối (chúng không chặn nhau, chỉ kiện khác và khối gia cố chặn): đi tối đa `stepMm`,
 * dừng sát vật cản gần nhất của kiện bị chặn nhiều nhất (gốc `nudgeBox`).
 */
export function nudgeBoxes(
  vehicle: EditVehicle,
  refs: readonly string[],
  axis: Axis,
  dir: -1 | 1,
  stepMm: number = LOAD_PLANNING_LIMITS.nudgeStepMm,
): Moved {
  const chosen = new Set(refs);
  const movers = vehicle.boxes.filter((box) => chosen.has(box.ref));
  if (movers.length === 0) return { ok: false, reason: "notFound" };
  const others = [...vehicle.boxes.filter((box) => !chosen.has(box.ref)), ...vehicle.gussets];
  const extent = extentOf(vehicle.innerMm);
  const travel = movers.reduce(
    (least, box) => Math.min(least, maxSlide(box, axis, dir, extent, others)),
    stepMm,
  );
  if (travel <= EPS) return { ok: false, reason: "nudgeBlocked" };
  const delta = dir * travel;
  return {
    ok: true,
    boxes: vehicle.boxes.map((box) =>
      chosen.has(box.ref)
        ? {
            ...box,
            xMm: axis === "x" ? box.xMm + delta : box.xMm,
            yMm: axis === "y" ? box.yMm + delta : box.yMm,
            zMm: axis === "z" ? box.zMm + delta : box.zMm,
          }
        : box,
    ),
  };
}

/**
 * Xoay các kiện đã chọn quanh góc nhỏ nhất của chúng. Kiện không được xoay (BR-10) chỉ giữ `LWH`; hướng mới phải vừa
 * (trong lòng xe, không chồng, đỡ ≥ 98%, lọt cửa) với mọi kiện đã chọn, nếu không cả lần xoay bị từ chối.
 */
export function rotateBoxes(
  vehicle: EditVehicle,
  refs: readonly string[],
  orientation: LayoutOrientation,
): Moved {
  const chosen = new Set(refs);
  if (!vehicle.boxes.some((box) => chosen.has(box.ref))) return { ok: false, reason: "notFound" };
  const proposed = vehicle.boxes.map((box): LayoutBox => {
    if (!chosen.has(box.ref)) return box;
    const extent = orientedExtent(box.origMm, orientation);
    return { ...box, ...extent, orientation };
  });
  const rotated = proposed.filter((box) => chosen.has(box.ref));
  if (rotated.some((box) => !box.rotatable && orientation !== "LWH"))
    return { ok: false, reason: "rotateForbidden" };
  const same = vehicle.boxes.every(
    (box, i) =>
      !chosen.has(box.ref) ||
      (proposed[i].wMm === box.wMm && proposed[i].hMm === box.hMm && proposed[i].dMm === box.dMm),
  );
  if (same) return { ok: false, reason: "unchanged" };
  const extent = extentOf(vehicle.innerMm);
  const fits = rotated.every(
    (box) =>
      passesDoor(box, vehicle.door) &&
      validatePlacement(
        box,
        extent,
        proposed.filter((other) => other.ref !== box.ref),
        vehicle.gussets,
      ).ok,
  );
  return fits ? { ok: true, boxes: proposed } : { ok: false, reason: "rotateNoFit" };
}

/** Thả kiện đang lơ lửng (đáy gần như không được đỡ) xuống vật nằm dưới (gốc `settleFloaters`). */
export function settleBoxes(vehicle: EditVehicle): Moved {
  const settled = settleFloaters(vehicle.boxes, vehicle.gussets);
  const changed = settled.some((box, i) => box.yMm !== vehicle.boxes[i].yMm);
  return changed ? { ok: true, boxes: settled } : { ok: false, reason: "nothingToSettle" };
}
