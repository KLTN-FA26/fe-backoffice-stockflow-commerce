"use client";

import { PLACEMENT_RULE_LABELS, UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { indexParcels } from "../../editor/parcels";
import { isVehicleKey } from "../../editor/precheck";

import type { EditorIssue } from "../../editor/precheck";
import type { EditorState } from "../../editor/types";

const I = UI_LABELS.loadPlan.editor.issues;

/** Nơi một vi phạm xảy ra, đọc được: "Xe #2 · PKG-…" / "Khay · PKG-…" / "Xe #2". */
function whereOf(state: EditorState, key: string): { text: string; ref: string | null } {
  if (isVehicleKey(key)) return { text: I.vehicle(Number(key.split(":")[1])), ref: null };
  const found = indexParcels(state).get(key);
  if (!found) return { text: key, ref: null };
  const place = found.seq === null ? I.tray : I.vehicle(found.seq);
  return { text: `${place} · ${found.parcel.label}`, ref: found.seq === null ? null : key };
}

/**
 * Kết quả kiểm tra trước khi lưu: mỗi vi phạm kèm luật bằng tiếng Việt và nút chọn kiện (chuyển sang đúng xe). Vi phạm
 * do máy chủ báo ở lần lưu trước nằm chung danh sách (đã tô đỏ trong khung 3D).
 */
export function IssuesPanel({
  state,
  issues,
  serverKeys,
  onFocus,
}: {
  state: EditorState;
  issues: readonly EditorIssue[];
  /** `key#rule` do máy chủ báo. */
  serverKeys: ReadonlySet<string>;
  onFocus: (ref: string) => void;
}) {
  if (issues.length === 0)
    return (
      <p role="status" className="text-positive text-xs">
        {I.ok}
      </p>
    );
  return (
    <section aria-label={I.title} className="space-y-2">
      <Alert tone="warning">{I.some(issues.length)}</Alert>
      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {issues.map(({ key, rule }) => {
          const where = whereOf(state, key);
          return (
            <li key={`${key}#${rule}`} className="flex items-start gap-2 text-xs">
              <span className="min-w-0 flex-1">
                <span className="text-ink-primary font-medium">{where.text}</span>
                <span className="text-danger block">
                  {PLACEMENT_RULE_LABELS[rule]}
                  {serverKeys.has(`${key}#${rule}`) && ` (${I.server})`}
                </span>
              </span>
              {where.ref && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  aria-label={`${I.select} ${where.text}`}
                  onClick={() => where.ref && onFocus(where.ref)}
                >
                  {I.select}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
