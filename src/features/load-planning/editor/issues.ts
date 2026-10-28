/**
 * Lỗi 422 `PLACEMENT_RULE_VIOLATION` của BE → vi phạm theo kiện. `fieldErrors[{field: ref | "vehicle:<seq>", code: rule}]`
 * (BE PR #161). Mỗi vi phạm nhớ TRẠNG THÁI đã gửi đi; chỉ hiện khi bố cục đang soạn chính là trạng thái đó. Mọi thay đổi
 * (nhích, xoay, đưa ra khay, đặt, hoàn tác, làm lại) làm vi phạm cũ hết hiệu lực: luật nhiều kiện (KIT_SPLIT, OVERLAP,
 * UNSUPPORTED) được sửa bằng cách dời MỘT KIỆN KHÁC hoặc hoàn tác, nên không thể chỉ gạt theo kiện bị báo. Hoàn tác về đúng
 * trạng thái đã gửi thì vi phạm hiện lại — đúng, vì bố cục lại y hệt.
 */

import { PLACEMENT_RULES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { indexParcels } from "./parcels";
import { isVehicleKey, vehicleKey } from "./precheck";

import type { PlacementRule } from "@/constants";
import type { EditorIssue } from "./precheck";
import type { EditorState } from "./types";

export const PLACEMENT_VIOLATION_CODE = "PLACEMENT_RULE_VIOLATION";

export interface ServerIssue extends EditorIssue {
  /** Trạng thái soạn lúc gửi (so sánh theo tham chiếu: trạng thái bất biến). */
  sent: EditorState;
}

const isRule = (code: string | undefined): code is PlacementRule =>
  PLACEMENT_RULES.some((rule) => rule === code);

/** Khoá (`ref` hoặc `vehicle:<seq>`) có thật trong trạng thái này không. */
function keyExists(state: EditorState, key: string): boolean {
  return isVehicleKey(key)
    ? state.vehicles.some((v) => vehicleKey(v.seq) === key)
    : indexParcels(state).has(key);
}

export const isPlacementViolation = (error: unknown): boolean =>
  error instanceof ApiError && error.code === PLACEMENT_VIOLATION_CODE;

/** Các vi phạm BE báo, gắn trạng thái `sent` đã gửi đi. Mã lạ / khoá lạ bị bỏ. */
export function serverIssuesOf(error: unknown, sent: EditorState): ServerIssue[] {
  if (!(error instanceof ApiError) || !isPlacementViolation(error)) return [];
  return (error.fieldErrorList ?? []).flatMap((entry) =>
    isRule(entry.code) && keyExists(sent, entry.field)
      ? [{ key: entry.field, rule: entry.code, sent }]
      : [],
  );
}

/** Vi phạm của BE còn đúng: bố cục đang soạn vẫn là bố cục đã gửi. */
export function activeServerIssues(
  issues: readonly ServerIssue[],
  state: EditorState,
): ServerIssue[] {
  return issues.filter((issue) => issue.sent === state);
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
