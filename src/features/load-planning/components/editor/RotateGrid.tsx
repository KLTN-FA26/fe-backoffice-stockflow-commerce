"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { formatLWH } from "../../lib/dims";
import { orientationsOf } from "../../lib/empty-spaces";
import { rotateBoxes } from "../../editor/moves";
import { peerRefs } from "../../editor/selectors";

import type { LayoutOrientation } from "@/constants";
import type { EditVehicle } from "../../editor/types";

const R = UI_LABELS.loadPlan.editor.selection.rotate;

/**
 * Các hướng đặt của kiện đang chọn: hướng hiện tại tô xanh, hướng không vừa chỗ hiện tại bị khoá (thử bằng chính phép xoay
 * của trình soạn nên khớp kết quả thật). Kiện không có cờ xoay (BR-10) không có lựa chọn; chọn lẫn nhiều loại thì không xoay.
 */
export function RotateGrid({
  vehicle,
  selected,
  onRotate,
}: {
  vehicle: EditVehicle;
  selected: readonly string[];
  onRotate: (orientation: LayoutOrientation) => void;
}) {
  const anchor = vehicle.boxes.find((box) => box.ref === selected[0]);
  if (!anchor) return null;
  const uniform = peerRefs(vehicle, anchor.ref);
  if (!selected.every((ref) => uniform.includes(ref)))
    return <p className="text-warning text-xs">{R.mixed}</p>;
  if (!anchor.rotatable) return <p className="text-ink-tertiary text-xs">{R.fixed}</p>;
  const poses = orientationsOf(anchor.origMm, true);
  if (poses.length <= 1) return <p className="text-ink-tertiary text-xs">{R.single}</p>;
  return (
    <div className="space-y-1">
      <p className="text-ink-tertiary text-xs">{R.title}</p>
      <div className="grid grid-cols-3 gap-1">
        {poses.map((pose) => {
          const current =
            pose.wMm === anchor.wMm && pose.hMm === anchor.hMm && pose.dMm === anchor.dMm;
          const fits = current || rotateBoxes(vehicle, selected, pose.orientation).ok;
          return (
            <button
              key={pose.orientation}
              type="button"
              disabled={!fits}
              aria-pressed={current}
              title={current ? R.current : fits ? undefined : R.noFit}
              onClick={() => onRotate(pose.orientation)}
              className={cn(
                "rounded border px-1 py-1 font-mono text-[11px] leading-tight",
                current
                  ? "border-brand bg-bg-subtle font-semibold"
                  : "border-border-default hover:bg-bg-subtle",
                !fits && "text-ink-tertiary cursor-not-allowed line-through opacity-50",
              )}
            >
              {formatLWH(pose, "")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
