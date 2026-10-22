"use client";

import { productRows } from "../../editor/selectors";

import { IssuesPanel } from "./IssuesPanel";
import { LinesPanel } from "./LinesPanel";
import { TrayPanel } from "./TrayPanel";

import type { PlacementRule } from "@/constants";
import type { EditorIssue } from "../../editor/precheck";
import type { ColorMap } from "../../lib/palette";
import type { EditorModel } from "../../editor/use-editor";

/** Cột phải: khay chung, mặt hàng trên xe (→ Khay) và kết quả kiểm tra trước khi lưu. */
export function EditorSidebar({
  editor,
  colorMap,
  issues,
  serverKeys,
  rulesOf,
  onFocus,
}: {
  editor: EditorModel;
  colorMap: ColorMap;
  issues: readonly EditorIssue[];
  serverKeys: ReadonlySet<string>;
  rulesOf: ReadonlyMap<string, readonly PlacementRule[]>;
  onFocus: (ref: string) => void;
}) {
  const flaggedKeys = new Set(
    editor.lines
      .filter((line) => line.parcels.some((p) => rulesOf.has(p.ref)))
      .map((line) => line.key),
  );
  return (
    <div className="space-y-3">
      <TrayPanel
        lines={editor.lines}
        colorMap={colorMap}
        selectedKey={editor.trayLine?.key ?? null}
        flaggedKeys={flaggedKeys}
        orientation={editor.orientation}
        spots={editor.ghosts.length}
        computing={editor.computing}
        onPick={editor.pickTrayLine}
        onOrientation={editor.setOrientation}
      />
      <LinesPanel
        rows={productRows(editor.vehicle)}
        colorMap={colorMap}
        onMoveOut={editor.toTray}
      />
      <IssuesPanel state={editor.state} issues={issues} serverKeys={serverKeys} onFocus={onFocus} />
    </div>
  );
}
