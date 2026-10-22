"use client";

import {
  LOAD_PLAN_EDITOR_REJECT_MESSAGES as REJECT,
  PLACEMENT_RULE_LABELS,
  UI_LABELS,
} from "@/constants";
import { Alert } from "@/components/shared/Alert";

import { ColorLegend } from "../detail/ColorLegend";

import { EditorViewer } from "./EditorViewer";
import { SelectionPanel } from "./SelectionPanel";

import type { BoxTone } from "../../lib/editor-scene";
import type { ColorMap } from "../../lib/palette";
import type { PlacementRule } from "@/constants";
import type { EditorModel } from "../../editor/use-editor";

const E = UI_LABELS.loadPlan.editor;

/** Cột chính: khung 3D của xe đang chỉnh, chú giải màu, lý do thao tác bị từ chối và bảng điều khiển kiện đang chọn. */
export function EditorMain({
  editor,
  colorMap,
  tones,
  rulesOf,
}: {
  editor: EditorModel;
  colorMap: ColorMap;
  tones: ReadonlyMap<string, BoxTone>;
  /** Luật bị vi phạm theo `ref`. */
  rulesOf: ReadonlyMap<string, readonly PlacementRule[]>;
}) {
  const { vehicle, selected, notice } = editor;
  const partNames = [...new Set(vehicle.boxes.map((box) => box.partName))].sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
  const ruleLabels = [
    ...new Set(
      selected.flatMap((ref) => rulesOf.get(ref) ?? []).map((rule) => PLACEMENT_RULE_LABELS[rule]),
    ),
  ];
  return (
    <div className="space-y-3">
      <EditorViewer
        vehicle={vehicle}
        colorMap={colorMap}
        tones={tones}
        ghosts={editor.ghosts}
        emptySpaces={editor.emptyShown}
        onBoxPick={editor.pickBox}
        onGhostPlace={editor.placeGhost}
        onBackgroundClick={editor.clearSelection}
      />
      <ColorLegend partNames={partNames} colorMap={colorMap} />
      {notice && (
        <div role="status">
          <Alert tone="warning">{REJECT[notice.reason]}</Alert>
        </div>
      )}
      <SelectionPanel
        vehicle={vehicle}
        otherSeqs={editor.state.vehicles.filter((v) => v.seq !== vehicle.seq).map((v) => v.seq)}
        selected={selected}
        ruleLabels={ruleLabels}
        onNudge={editor.nudge}
        onRotate={editor.rotate}
        onToTray={() => editor.toTray()}
        onMoveToVehicle={editor.moveToVehicle}
        onSelectPeers={editor.selectPeers}
        onSelectKit={editor.selectKit}
        onDeselect={editor.clearSelection}
      />
      <p className="text-ink-tertiary text-xs">{E.description}</p>
    </div>
  );
}
