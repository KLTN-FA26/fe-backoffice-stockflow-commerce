"use client";

import { useEffect, useMemo, useRef } from "react";

import { MODEL3D_VIEW_LABELS as LABELS } from "@/constants/labels-model3d";
import { MODEL3D_VIEW as VIEW } from "@/constants/numbers";
import { cn } from "cn";

import { printedWidthMm } from "../../model3d/cup-sector";
import { readGridColors } from "../../model3d/grid-colors";
import { drawGridTexture, gridPxPerMm } from "../../model3d/grid-texture";
import { createSurfaces } from "../../model3d/surfaces";
import { formatMm } from "../format-mm";

import type {
  BagModel,
  CupModel,
  CustomizationTemplate,
  PrintArea,
} from "../../model3d/model-types";
import type { PrintSurface } from "../../model3d/surface-types";

/** One print area flat, with the same numbered grid as on the model, so a number can be found in both. */
function PrintSheet({
  area,
  surface,
  seamAtMm,
  stamp,
}: {
  area: PrintArea;
  surface: PrintSurface;
  seamAtMm: number | null;
  stamp: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    drawGridTexture(canvas, surface, {
      pxPerMm: gridPxPerMm(surface.flatBounds) * VIEW.sheetScale,
      colors: readGridColors(),
      seamAtMm,
    });
  }, [surface, seamAtMm, stamp]);

  const { width, height } = surface.flatBounds;
  const size = `${formatMm(area.widthMm)} × ${formatMm(area.heightMm)}`;
  // No card of its own: the sheet already sits in the panel "Khuôn phẳng của từng phần in". The frame is a padded box
  // around the canvas, not the canvas's own edge (the canvas is exactly the sheet's bounds, so a border on it touched the
  // sheet). The sheet takes the full width inside (drawn at a high pixel density, so it stays sharp when large).
  return (
    <figure className="space-y-2">
      <div className="border-border-default bg-bg-surface rounded-[var(--r-md)] border p-4 sm:p-6">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={LABELS.sheetLabel(area.name)}
          className="block h-auto w-full"
          style={{ aspectRatio: `${width} / ${height}` }}
        />
      </div>
      <figcaption className="text-ink-secondary text-center text-xs tabular-nums">
        {LABELS.sheetCaption(area.name, size, formatMm(area.bleedMm), formatMm(area.safeMarginMm))}
      </figcaption>
    </figure>
  );
}

/**
 * The flat sheet of every print area of the template: one sheet (a cup's body) fills the panel; several (a bag's
 * faces) go two to a row. `large` is the panel expanded over the page.
 */
export function PrintSheets({
  template,
  model,
  stamp,
  large = false,
}: {
  template: CustomizationTemplate;
  model: CupModel | BagModel;
  stamp: string;
  large?: boolean;
}) {
  const surfaces = useMemo(() => createSurfaces(template), [template]);
  const several = template.printAreas.length > 1;
  return (
    <div
      className={cn(
        "grid gap-4",
        several && "sm:grid-cols-2",
        large && !several && "mx-auto max-w-6xl",
      )}
    >
      {template.printAreas.map((area) => {
        const surface = surfaces.byCode[area.code];
        if (!surface) return null;
        const seamAtMm = model.kind === "parametric-cup" ? printedWidthMm(model, surface) : null;
        return (
          <PrintSheet
            key={area.code}
            area={area}
            surface={surface}
            seamAtMm={seamAtMm}
            stamp={stamp}
          />
        );
      })}
    </div>
  );
}
