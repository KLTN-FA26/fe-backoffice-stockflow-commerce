"use client";

import { ArrowDownToLine, Redo2, Scan, Square, SquareCheck, Undo2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

const T = UI_LABELS.loadPlan.editor.toolbar;

export interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  multi: boolean;
  selectedCount: number;
  showEmpty: boolean;
  computing: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleMulti: () => void;
  onToggleEmpty: () => void;
  onSettle: () => void;
}

/** Công cụ chung của trình soạn: hoàn tác / làm lại, chọn nhiều, xem chỗ trống, hạ kiện lơ lửng (gốc: thanh công cụ). */
export function EditorToolbar(props: EditorToolbarProps) {
  return (
    <div role="toolbar" aria-label={T.group} className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!props.canUndo}
        onClick={props.onUndo}
      >
        <Undo2 aria-hidden />
        {T.undo}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!props.canRedo}
        onClick={props.onRedo}
      >
        <Redo2 aria-hidden />
        {T.redo}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={props.multi ? "secondary" : "outline"}
        aria-pressed={props.multi}
        onClick={props.onToggleMulti}
      >
        {props.multi ? <SquareCheck aria-hidden /> : <Square aria-hidden />}
        {props.multi ? T.multiOn(props.selectedCount) : T.multiOff}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={props.showEmpty ? "secondary" : "outline"}
        aria-pressed={props.showEmpty}
        onClick={props.onToggleEmpty}
      >
        <Scan aria-hidden />
        {props.showEmpty ? T.emptyOn : T.emptyOff}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={props.onSettle}>
        <ArrowDownToLine aria-hidden />
        {T.settle}
      </Button>
      {props.computing && (
        <span role="status" className="text-ink-tertiary text-xs">
          {T.computing}
        </span>
      )}
    </div>
  );
}
