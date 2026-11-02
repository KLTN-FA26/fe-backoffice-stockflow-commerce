"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronsDown, ChevronsUp } from "lucide-react";

import { LOAD_PLANNING_LIMITS, UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import type { Axis } from "../../editor/types";

const N = UI_LABELS.loadPlan.editor.selection.nudge;

type Dir = -1 | 1;

/**
 * Bàn phím nhích: mũi tên = ngang xe (x) và dọc xe (z, lên = ra phía cửa), hai nút kép = lên / xuống (y). Nhích tối đa
 * `nudgeStepMm` và dừng sát vật cản (gốc `moveGrid` + `moveY`).
 */
export function NudgePad({ onNudge }: { onNudge: (axis: Axis, dir: Dir) => void }) {
  const cell = (label: string, icon: React.ReactNode, axis: Axis, dir: Dir) => (
    <Button
      type="button"
      size="icon-sm"
      variant="outline"
      title={`${label} (${LOAD_PLANNING_LIMITS.nudgeStepMm} mm)`}
      aria-label={label}
      onClick={() => onNudge(axis, dir)}
    >
      {icon}
    </Button>
  );
  return (
    <div className="flex items-center gap-2">
      <div className="grid grid-cols-3 gap-0.5">
        <span />
        {cell(N.toDoor, <ArrowUp aria-hidden />, "z", 1)}
        <span />
        {cell(N.left, <ArrowLeft aria-hidden />, "x", -1)}
        <span
          aria-hidden
          className="bg-bg-muted text-ink-tertiary flex items-center justify-center rounded text-[10px]"
        >
          ±
        </span>
        {cell(N.right, <ArrowRight aria-hidden />, "x", 1)}
        <span />
        {cell(N.inward, <ArrowDown aria-hidden />, "z", -1)}
        <span />
      </div>
      <div className="flex flex-col gap-0.5">
        {cell(N.up, <ChevronsUp aria-hidden />, "y", 1)}
        {cell(N.down, <ChevronsDown aria-hidden />, "y", -1)}
      </div>
    </div>
  );
}
