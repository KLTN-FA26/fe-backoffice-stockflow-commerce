/**
 * Lỗi 422 `PLACEMENT_RULE_VIOLATION` của BE → vi phạm theo kiện. `fieldErrors[{field: ref | "vehicle:<seq>", code: rule}]`
 * (BE PR #161). Mỗi vi phạm nhớ "chữ ký" chỗ đặt của kiện lúc bị báo; kiện đã được người dùng sửa (chữ ký đổi) thì vi phạm
 * cũ không còn hiện — nó nói về vị trí cũ.
 */

import { PLACEMENT_RULES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { indexParcels, weightOf } from "./parcels";
import { isVehicleKey, vehicleKey } from "./precheck";

import type { PlacementRule } from "@/constants";
import type { EditorIssue } from "./precheck";
import type { EditorState } from "./types";

export const PLACEMENT_VIOLATION_CODE = "PLACEMENT_RULE_VIOLATION";

export interface ServerIssue extends EditorIssue {
  signature: string;
}

const isRule = (code: string | undefined): code is PlacementRule =>
  PLACEMENT_RULES.some((rule) => rule === code);

/** Chữ ký chỗ đặt hiện tại của một khoá; `null` nếu khoá không còn trong kế hoạch. */
export function signatureOf(state: EditorState, key: string): string | null {
  if (isVehicleKey(key)) {
    const vehicle = state.vehicles.find((v) => vehicleKey(v.seq) === key);
    return vehicle ? `${vehicle.boxes.length}|${weightOf(vehicle.boxes)}` : null;
  }
  const found = indexParcels(state).get(key);
  if (!found) return null;
  const { box } = found;
  return box
    ? `${found.seq}|${box.xMm}|${box.yMm}|${box.zMm}|${box.wMm}|${box.hMm}|${box.dMm}`
    : "tray";
}

export const isPlacementViolation = (error: unknown): boolean =>
  error instanceof ApiError && error.code === PLACEMENT_VIOLATION_CODE;

/** Các vi phạm BE báo, gắn chữ ký của `sent` (trạng thái đã gửi đi). Mã lạ / khoá lạ bị bỏ. */
export function serverIssuesOf(error: unknown, sent: EditorState): ServerIssue[] {
  if (!(error instanceof ApiError) || !isPlacementViolation(error)) return [];
  const out: ServerIssue[] = [];
  for (const entry of error.fieldErrorList ?? []) {
    const signature = isRule(entry.code) ? signatureOf(sent, entry.field) : null;
    if (isRule(entry.code) && signature !== null)
      out.push({ key: entry.field, rule: entry.code, signature });
  }
  return out;
}

/** Vi phạm của BE còn đúng với trạng thái đang soạn (kiện chưa bị sửa kể từ lần gửi). */
export function activeServerIssues(
  issues: readonly ServerIssue[],
  state: EditorState,
): ServerIssue[] {
  return issues.filter((issue) => signatureOf(state, issue.key) === issue.signature);
}

/** Gộp vi phạm tại chỗ và của BE; cùng khoá + luật chỉ hiện một lần. */
export function mergeIssues(
  local: readonly EditorIssue[],
  server: readonly ServerIssue[],
): EditorIssue[] {
  const seen = new Set<string>();
  const out: EditorIssue[] = [];
  for (const { key, rule } of [...local, ...server]) {
    const id = `${key}#${rule}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ key, rule });
  }
  return out;
}
