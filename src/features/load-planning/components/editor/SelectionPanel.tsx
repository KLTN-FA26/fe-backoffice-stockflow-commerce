"use client";

import { PackageOpen, X } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { kitRefs, peerRefs } from "../../editor/selectors";

import { NudgePad } from "./NudgePad";
import { RotateGrid } from "./RotateGrid";

import type { LayoutOrientation } from "@/constants";
import type { Axis, EditVehicle } from "../../editor/types";

const S = UI_LABELS.loadPlan.editor.selection;

export interface SelectionPanelProps {
  vehicle: EditVehicle;
  /** Các xe khác — đích của "Chuyển sang xe". */
  otherSeqs: readonly number[];
  selected: readonly string[];
  /** Vi phạm của các kiện đang chọn (đã dịch) — kiện đang chọn tô xanh nên lỗi phải hiện ở đây. */
  ruleLabels: readonly string[];
  onNudge: (axis: Axis, dir: -1 | 1) => void;
  onRotate: (orientation: LayoutOrientation) => void;
  onToTray: () => void;
  onMoveToVehicle: (seq: number) => void;
  onSelectPeers: () => void;
  onSelectKit: () => void;
  onDeselect: () => void;
}

/** Kiện đang chọn: nhích, xoay, đưa ra khay, chuyển sang xe khác, chọn thêm kiện cùng loại / cùng bộ. */
export function SelectionPanel(props: SelectionPanelProps) {
  const { vehicle, selected } = props;
  const first = vehicle.boxes.find((box) => box.ref === selected[0]);
  if (!first) {
    return (
      <p className="border-border-default text-ink-tertiary rounded border border-dashed p-3 text-[0.8125rem]">
        {S.none}
      </p>
    );
  }
  const peers = peerRefs(vehicle, first.ref).length;
  const kit = kitRefs(vehicle, first.ref).length;
  return (
    <section aria-label={S.title} className="border-border-default space-y-3 rounded border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-ink-primary truncate text-[0.8125rem] font-medium">
            {selected.length > 1 ? S.count(selected.length) : `${first.partName} · ${first.label}`}
          </p>
          {selected.length === 1 && (
            <p className="text-ink-tertiary text-xs tabular-nums">
              {S.position(Math.round(first.xMm), Math.round(first.yMm), Math.round(first.zMm))}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={S.deselect}
          onClick={props.onDeselect}
        >
          <X aria-hidden />
        </Button>
      </div>
      {props.ruleLabels.length > 0 && (
        <ul className="text-danger space-y-0.5 text-xs">
          {props.ruleLabels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      )}
      <NudgePad onNudge={props.onNudge} />
      <p className="text-ink-tertiary text-xs">{S.stepNote}</p>
      <RotateGrid vehicle={vehicle} selected={selected} onRotate={props.onRotate} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={props.onToTray}>
          <PackageOpen aria-hidden />
          {selected.length > 1 ? S.toTrayN(selected.length) : S.toTray}
        </Button>
        {props.otherSeqs.map((seq) => (
          <Button
            key={seq}
            type="button"
            size="sm"
            variant="outline"
            title={S.toVehicleHint}
            onClick={() => props.onMoveToVehicle(seq)}
          >
            {S.toVehicle(seq)}
          </Button>
        ))}
        {peers > selected.length && (
          <Button type="button" size="sm" variant="ghost" onClick={props.onSelectPeers}>
            {S.selectPeers(peers)}
          </Button>
        )}
        {kit > selected.length && (
          <Button type="button" size="sm" variant="ghost" onClick={props.onSelectKit}>
            {S.selectKit(kit)}
          </Button>
        )}
      </div>
    </section>
  );
}
