/**
 * Thân `PUT /fulfillment/load-plans/{id}/placements` (BE `LoadPlacementsRequest`): MỌI xe của kế hoạch (xe để trống bị bỏ
 * khỏi kế hoạch), mỗi kiện đúng một lần ở xe hoặc ở khay. Hộp gửi `ref`, góc, kích thước đã xếp theo ba trục (kích thước
 * quyết định, BE tự suy hướng) và `orientation`; số nguyên mm.
 */

import { LOAD_PLAN_LIMITS } from "@/constants";

import type { EditorState } from "./types";

export interface PlacementBoxPayload {
  ref: string;
  xMm: number;
  yMm: number;
  zMm: number;
  wMm: number;
  hMm: number;
  dMm: number;
  orientation: string;
}

export interface PlacementsPayload {
  expectedVersion: number;
  vehicles: { seq: number; boxes: PlacementBoxPayload[] }[];
  tray: string[];
}

export function buildPlacementsPayload(
  state: EditorState,
  expectedVersion: number,
): PlacementsPayload {
  return {
    expectedVersion,
    vehicles: state.vehicles.map((vehicle) => ({
      seq: vehicle.seq,
      boxes: vehicle.boxes.map((box) => ({
        ref: box.ref,
        xMm: Math.round(box.xMm),
        yMm: Math.round(box.yMm),
        zMm: Math.round(box.zMm),
        wMm: Math.round(box.wMm),
        hMm: Math.round(box.hMm),
        dMm: Math.round(box.dMm),
        orientation: box.orientation,
      })),
    })),
    tray: state.tray.map((parcel) => parcel.ref),
  };
}

/** Vượt giới hạn `@Size` của BE: không gửi được (BE trả 400 chung chung). */
export function exceedsPlacementLimits(state: EditorState): boolean {
  return (
    state.vehicles.length > LOAD_PLAN_LIMITS.placementVehiclesMax ||
    state.tray.length > LOAD_PLAN_LIMITS.placementBoxesMax ||
    state.vehicles.some((v) => v.boxes.length > LOAD_PLAN_LIMITS.placementBoxesMax)
  );
}
