"use client";

import { useMemo } from "react";

import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";

import { exceedsPlacementLimits } from "../../editor/payload";
import { useEditor } from "../../editor/use-editor";
import { useEditorIssues } from "../../editor/use-editor-issues";
import { useSaveFlow } from "../../editor/use-save-flow";
import { useUnsavedGuard } from "../../editor/use-unsaved-guard";
import { buildColorMap } from "../../lib/palette";

import { ConflictPanel } from "./ConflictPanel";
import { EditorMain } from "./EditorMain";
import { EditorSidebar } from "./EditorSidebar";
import { EditorToolbar } from "./EditorToolbar";
import { EditorVehicleTabs } from "./EditorVehicleTabs";
import { SaveBar } from "./SaveBar";

import type { DoorsByType } from "../../editor/build-state";
import type { EditorState } from "../../editor/types";

const E = UI_LABELS.loadPlan.editor;

export interface PlacementEditorProps {
  loadPlanId: string;
  /** Trạng thái lúc mở và `version` của kế hoạch khi đó; không đổi theo dữ liệu tải lại ngầm. */
  initial: EditorState;
  openedVersion: number;
  doors: DoorsByType;
  onExit: () => void;
}

/**
 * Trình soạn xếp tay (port `manual-edit-view` + `manual-packing-editor`): chọn / nhích / xoay kiện, đưa ra khay chung, đặt
 * từ khay lên xe (kể cả xe khác), hoàn tác / làm lại. Mọi thay đổi ở bộ nhớ tới khi bấm Lưu (một `PUT …/placements`
 * nguyên tử, BE kiểm lại toàn bộ). Bản soạn chỉ khởi tạo MỘT lần từ `initial`: tải lại ngầm không ghi đè chỉnh sửa.
 */
export function PlacementEditor({
  loadPlanId,
  initial,
  openedVersion,
  doors,
  onExit,
}: PlacementEditorProps) {
  const editor = useEditor(initial);
  const { state, selected } = editor;
  const save = useSaveFlow({
    loadPlanId,
    openedVersion,
    state,
    baseline: editor.baseline,
    doors,
    onReload: editor.reset,
    onSaved: onExit,
  });
  const colorMap = useMemo(
    () =>
      buildColorMap(
        [...initial.vehicles.flatMap((v) => v.boxes), ...initial.tray].map((p) => p.partName),
      ),
    [initial],
  );
  const { issues, rulesOf, serverKeys, serverActive, tones, flaggedSeqs } = useEditorIssues(
    state,
    selected,
    save.serverIssues,
  );
  useUnsavedGuard(editor.dirty);

  const focus = (ref: string) => {
    const found = state.vehicles.find((v) => v.boxes.some((b) => b.ref === ref));
    if (found) editor.selectVehicle(found.seq);
    editor.pickBox(ref, false);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-ink-primary text-sm font-medium">{E.title}</h2>
      <EditorToolbar
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        multi={editor.multi}
        selectedCount={selected.length}
        showEmpty={editor.showEmpty}
        computing={editor.computing}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onToggleMulti={() => editor.setMulti((on) => !on)}
        onToggleEmpty={editor.toggleEmpty}
        onSettle={editor.settle}
      />
      {save.conflict && (
        <ConflictPanel
          kind={save.conflict.kind}
          message={save.conflict.message}
          diff={save.diff}
          ready={save.serverReady}
          failed={save.refreshFailed}
          onRetry={save.retry}
          saving={save.saving}
          onReload={save.reload}
          onOverwrite={save.overwrite}
        />
      )}
      {save.error && <Alert tone="danger">{save.error}</Alert>}
      {serverActive.length > 0 && (
        <Alert tone="danger">{E.save.violation(serverActive.length)}</Alert>
      )}
      <EditorVehicleTabs
        vehicles={state.vehicles}
        selectedSeq={editor.vehicle.seq}
        flaggedSeqs={flaggedSeqs}
        onSelect={editor.selectVehicle}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <EditorMain editor={editor} colorMap={colorMap} tones={tones} rulesOf={rulesOf} />
        <EditorSidebar
          editor={editor}
          colorMap={colorMap}
          issues={issues}
          serverKeys={serverKeys}
          rulesOf={rulesOf}
          onFocus={focus}
        />
      </div>
      <SaveBar
        dirty={editor.dirty}
        saving={save.saving}
        issueCount={issues.length}
        emptiedSeqs={state.vehicles.filter((v) => v.boxes.length === 0).map((v) => v.seq)}
        tooMany={exceedsPlacementLimits(state)}
        onSave={save.save}
        onExit={onExit}
      />
    </div>
  );
}
