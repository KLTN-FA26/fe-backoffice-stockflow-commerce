/**
 * Kiểm tra luật xếp phía trình duyệt TRƯỚC khi lưu (BR-10/BR-11, docs 09 §6): trong lòng xe, không chồng, đỡ ≥ 98%,
 * đúng hướng, kiện không xoay được, vướng khối gia cố, tải trọng từng xe (cùng `checkLayout` của F1) cộng cửa xe (LP3-DOOR)
 * và bộ bị tách khỏi một xe (LP-3, khay tính là một chỗ). BE vẫn là nơi quyết định — đây chỉ để thấy lỗi sớm.
 *
 * Kết quả theo xe được nhớ theo mảng kiện của xe (không đổi tham chiếu = không tính lại), nên sửa một xe không phải
 * kiểm lại các xe khác.
 */

import { checkLayout } from "../lib/layout-check";
import { passesDoor } from "../lib/dims";

import type { PlacementRule } from "@/constants";
import type { LayoutBox } from "../types";
import type { EditVehicle, EditorState } from "./types";

export interface EditorIssue {
  /** `ref` của kiện, hoặc `vehicle:<seq>` cho lỗi cấp xe (quá tải) — đúng khoá `fieldErrors[].field` của BE. */
  key: string;
  rule: PlacementRule;
}

export const vehicleKey = (seq: number): string => `vehicle:${seq}`;
export const isVehicleKey = (key: string): boolean => key.startsWith("vehicle:");
const TRAY = "tray";

const perVehicle = new WeakMap<readonly LayoutBox[], EditorIssue[]>();

function checkVehicle(vehicle: EditVehicle): EditorIssue[] {
  const cached = perVehicle.get(vehicle.boxes);
  if (cached) return cached;
  const found = checkLayout({
    seq: vehicle.seq,
    code: vehicle.code,
    innerMm: vehicle.innerMm,
    maxPayloadKg: vehicle.maxPayloadKg,
    gussets: [...vehicle.gussets],
    boxes: [...vehicle.boxes],
    usedVolumeMm3: 0,
    usedWeightKg: 0,
  }).map((issue) => ({ key: issue.ref ?? vehicleKey(vehicle.seq), rule: issue.rule }));
  for (const box of vehicle.boxes)
    if (!passesDoor(box, vehicle.door)) found.push({ key: box.ref, rule: "DOOR" });
  perVehicle.set(vehicle.boxes, found);
  return found;
}

/** Một bộ có kiện ở từ hai chỗ (xe khác nhau, hoặc xe và khay) → mọi kiện của bộ bị báo (như `validateKitGroups`). */
function kitSplits(state: EditorState): EditorIssue[] {
  const where = new Map<string, Set<string>>();
  const members: { ref: string; group: string }[] = [];
  const note = (ref: string, group: string | null, place: string) => {
    if (!group) return;
    members.push({ ref, group });
    const set = where.get(group) ?? new Set<string>();
    set.add(place);
    where.set(group, set);
  };
  for (const vehicle of state.vehicles)
    for (const box of vehicle.boxes) note(box.ref, box.kitGroup, String(vehicle.seq));
  for (const parcel of state.tray) note(parcel.ref, parcel.kitGroup, TRAY);
  return members
    .filter(({ group }) => (where.get(group)?.size ?? 0) > 1)
    .map(({ ref }) => ({ key: ref, rule: "KIT_SPLIT" as const }));
}

export function precheck(state: EditorState): EditorIssue[] {
  return [...state.vehicles.flatMap(checkVehicle), ...kitSplits(state)];
}

/** Gom theo khoá để tô màu / hiện lý do cạnh từng kiện. */
export function issuesByKey(issues: readonly EditorIssue[]): Map<string, PlacementRule[]> {
  const map = new Map<string, PlacementRule[]>();
  for (const { key, rule } of issues) {
    const rules = map.get(key) ?? [];
    if (!rules.includes(rule)) rules.push(rule);
    map.set(key, rules);
  }
  return map;
}
