"use client";

import { useEffect, useMemo, useRef } from "react";

import { MODEL3D_VIEW_LABELS as LABELS } from "@/constants/labels-model3d";
import { MODEL3D_VIEW as VIEW } from "@/constants/numbers";

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
  return (
    <figure className="border-border-default bg-bg-surface space-y-2 rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={LABELS.sheetLabel(area.name)}
        className="border-border-default mx-auto block h-auto max-h-80 w-auto max-w-full rounded-[var(--r-sm)] border"
        style={{ aspectRatio: `${width} / ${height}` }}
      />
      <figcaption className="text-ink-secondary text-center text-xs tabular-nums">
        {LABELS.sheetCaption(area.name, size, formatMm(area.bleedMm), formatMm(area.safeMarginMm))}
      </figcaption>
    </figure>
  );
}

/** The flat sheet of every print area of the template. */
export function PrintSheets({
  template,
  model,
  stamp,
}: {
  template: CustomizationTemplate;
  model: CupModel | BagModel;
  stamp: string;
}) {
  const surfaces = useMemo(() => createSurfaces(template), [template]);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
