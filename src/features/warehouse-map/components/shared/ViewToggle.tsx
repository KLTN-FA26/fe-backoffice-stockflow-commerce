"use client";

import { Box, Grid2x2 } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import type { LucideIcon } from "lucide-react";
import type { MapView } from "../map/useMapUrlState";

const M = UI_LABELS.warehouseMap.map;
const VIEWS: { view: MapView; label: string; icon: LucideIcon }[] = [
  { view: "2d", label: M.view2d, icon: Grid2x2 },
  { view: "3d", label: M.view3d, icon: Box },
];
const OUTLINE = `${TOOLBAR_ACTION_CLASS} border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted border`;

/** Cặp nút 2D / 3D — dùng chung cho chế độ xem (state trên URL) và chế độ sửa (state cục bộ). */
export function ViewToggle({
  view,
  onChange,
}: {
  view: MapView;
  onChange: (view: MapView) => void;
}) {
  return (
    <div role="group" aria-label={M.viewToggle} className="flex gap-1">
      {VIEWS.map(({ view: value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={
            view === value
              ? `${TOOLBAR_ACTION_CLASS} bg-brand text-ink-inverse hover:bg-brand-hover`
              : OUTLINE
          }
        >
          <Icon className="size-3.5" /> {label}
        </Button>
      ))}
    </div>
  );
}
