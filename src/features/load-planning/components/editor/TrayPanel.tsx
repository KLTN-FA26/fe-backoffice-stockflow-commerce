"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { formatLWH } from "../../lib/dims";
import { orientationsOf } from "../../lib/empty-spaces";

import type { LayoutOrientation } from "@/constants";
import { LandingSpotList } from "./LandingSpotList";

import type { LandingGhost } from "../../lib/empty-spaces";
import type { ColorMap } from "../../lib/palette";
import type { TrayLine } from "../../editor/selectors";

const T = UI_LABELS.loadPlan.editor.tray;

export interface TrayPanelProps {
  lines: readonly TrayLine[];
  colorMap: ColorMap;
  selectedKey: string | null;
  /** Dòng có kiện vi phạm luật (vd bộ bị tách). */
  flaggedKeys: ReadonlySet<string>;
  orientation: LayoutOrientation | null;
  /** Ô gợi ý chỗ đặt của dòng đang chọn trên xe đang xem. */
  ghosts: readonly LandingGhost[];
  vehicleSeq: number;
  onPlace: (id: string) => void;
  onActiveSpot: (id: string | null) => void;
  computing: boolean;
  onPick: (key: string) => void;
  onOrientation: (orientation: LayoutOrientation | null) => void;
}

/**
 * Khay chung: kiện chưa xếp (của solver) và kiện vừa đưa ra. Chọn một dòng rồi bấm ô xanh trong khung 3D để đặt vào xe
 * đang xem; chọn hướng để thu hẹp các ô (mặc định mọi hướng, như gốc "Tất cả").
 */
export function TrayPanel(props: TrayPanelProps) {
  const total = props.lines.reduce((sum, line) => sum + line.parcels.length, 0);
  const selected = props.lines.find((line) => line.key === props.selectedKey);
  const first = selected?.parcels[0];
  const poses = first ? orientationsOf(first.origMm, first.rotatable) : [];
  return (
    <section aria-label={T.title} className="border-border-default space-y-2 rounded border p-3">
      <h3 className="text-ink-primary text-sm font-medium">
        {T.title} ({total})
      </h3>
      {props.lines.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{T.empty}</p>
      ) : (
        <>
          <p className="text-ink-tertiary text-xs">{T.hint}</p>
          <ul className="flex flex-wrap gap-1.5">
            {props.lines.map((line) => {
              const active = line.key === props.selectedKey;
              return (
                <li key={line.key}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={T.pick(line.partName)}
                    onClick={() => props.onPick(line.key)}
                    className={cn(
                      "rounded border px-2 py-1 text-xs",
                      active
                        ? "border-positive bg-bg-subtle font-semibold"
                        : "border-border-default hover:bg-bg-subtle",
                      props.flaggedKeys.has(line.key) && "border-danger text-danger",
                    )}
                  >
                    <span
                      aria-hidden
                      className="mr-1 inline-block size-2 rounded-sm align-middle"
                      style={{ background: props.colorMap.get(line.partName) }}
                    />
                    {T.line(line.partName, line.parcels.length)}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {selected && first && (
        <div className="space-y-1.5" aria-live="polite">
          <p className="text-ink-primary text-xs font-medium">
            {T.selected(selected.partName, selected.parcels.length)}
          </p>
          {poses.length > 1 && (
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="xs"
                variant={props.orientation === null ? "secondary" : "outline"}
                onClick={() => props.onOrientation(null)}
              >
                {T.allOrientations}
              </Button>
              {poses.map((pose) => (
                <Button
                  key={pose.orientation}
                  type="button"
                  size="xs"
                  className="font-mono"
                  variant={props.orientation === pose.orientation ? "secondary" : "outline"}
                  onClick={() => props.onOrientation(pose.orientation)}
                >
                  {formatLWH(pose, "")}
                </Button>
              ))}
            </div>
          )}
          <p
            role="status"
            className={cn(
              "text-xs",
              props.ghosts.length === 0 && !props.computing ? "text-danger" : "text-positive",
            )}
          >
            {props.computing
              ? T.computing
              : props.ghosts.length === 0
                ? T.noSpots
                : T.spots(props.ghosts.length)}
          </p>
          <LandingSpotList
            key={selected.key}
            ghosts={props.ghosts}
            vehicleSeq={props.vehicleSeq}
            onPlace={props.onPlace}
            onActive={props.onActiveSpot}
          />
        </div>
      )}
    </section>
  );
}
