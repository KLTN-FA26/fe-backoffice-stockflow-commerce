"use client";

import { UI_LABELS, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { Button } from "@/components/ui/button";

import { Section } from "./fields";
import { NumberField } from "./NumberField";

import type { Footprint } from "@/features/warehouse-map/types";

const E = UI_LABELS.warehouseMap.editor;
const I = UI_LABELS.warehouseMap.edit.inspector;

/**
 * Toạ độ + kích thước + góc xoay của kệ / khu vực — chỉnh tinh tới milimét sau khi kéo thả. Góc xoay
 * chỉ 0 / 90 / 180 / 270 (BR-09); (x, y) là góc trên-trái sau khi xoay như BE `Footprint`.
 */
export function PlacementFields({
  idPrefix,
  footprint,
  disabled,
  error,
  onChange,
}: {
  idPrefix: string;
  footprint: Footprint;
  disabled: boolean;
  error?: string;
  onChange: (footprint: Footprint) => void;
}) {
  const set = (key: keyof Footprint) => (value: number | null) => {
    if (value !== null) onChange({ ...footprint, [key]: value });
  };
  return (
    <Section title={I.placement} error={error}>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          id={`${idPrefix}-x`}
          label={E.x}
          value={footprint.x}
          onCommit={set("x")}
          disabled={disabled}
        />
        <NumberField
          id={`${idPrefix}-y`}
          label={E.y}
          value={footprint.y}
          onCommit={set("y")}
          disabled={disabled}
        />
        <NumberField
          id={`${idPrefix}-width`}
          label={E.width}
          value={footprint.width}
          onCommit={set("width")}
          disabled={disabled}
        />
        <NumberField
          id={`${idPrefix}-length`}
          label={E.length}
          value={footprint.length}
          onCommit={set("length")}
          disabled={disabled}
        />
      </div>
      <div role="group" aria-label={E.rotation} className="flex items-center gap-1">
        <span className="text-ink-secondary mr-1 text-xs font-medium">{E.rotation}</span>
        {LIMITS.rotations.map((rotation) => (
          <Button
            key={rotation}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            aria-pressed={footprint.rotation === rotation}
            onClick={() => onChange({ ...footprint, rotation })}
            className="aria-pressed:bg-brand aria-pressed:text-ink-inverse h-7 px-2 font-[family-name:var(--font-mono)] text-xs tabular-nums"
          >
            {rotation}°
          </Button>
        ))}
      </div>
    </Section>
  );
}
