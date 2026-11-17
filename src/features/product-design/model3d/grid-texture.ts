// Ported from stockflow-storefront src/features/product-design/components/model-check/grid-texture.ts
// (kept in docs/superpowers/patches/2026-11-13-glb-do-kiem.patch). `GridColors` is declared here.
import { MODEL3D_GRID_LABELS as LABELS } from "@/constants/labels-model3d";
import { MODEL3D_GRID as GRID } from "@/constants/numbers";

import type { PathCmd, PrintSurface, RectMm } from "./surface-types";

/** A line every 10 mm, heavier every 50 mm; a number in each 50 mm cell. */
export const GRID_STEP_MM = GRID.stepMm;
export const GRID_CELL_MM = GRID.cellMm;

/** Colours the grid is painted with; a canvas cannot read CSS variables, so the caller passes them. */
export type GridColors = {
  paper: string;
  minor: string;
  major: string;
  number: string;
  trim: string;
  safe: string;
  bleed: string;
  /** The heavy line and note at the top edge. */
  top: string;
  /** The heavy line and note at the left edge, and the glue flap past it. */
  left: string;
};

/** The scale that makes the longest edge of the surface's bleed box `GRID.longEdgePx` pixels. */
export function gridPxPerMm(flatBounds: RectMm): number {
  return GRID.longEdgePx / Math.max(flatBounds.width, flatBounds.height);
}

export type GridOptions = {
  pxPerMm: number;
  colors: GridColors;
  /**
   * Where the glue flap starts along the print's width (a cup); `null` when the whole width is
   * printed on the product (a bag face). The left edge is the seam of a cup.
   */
  seamAtMm: number | null;
};

type Ctx = CanvasRenderingContext2D;

function tracePath(ctx: Ctx, path: PathCmd[]): void {
  ctx.beginPath();
  for (const cmd of path) {
    if (cmd.c === "M") ctx.moveTo(cmd.x, cmd.y);
    else if (cmd.c === "L") ctx.lineTo(cmd.x, cmd.y);
    else if (cmd.c === "A") ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.start, cmd.end, cmd.ccw);
    else ctx.closePath();
  }
}

const range = (from: number, to: number, step: number) => {
  const values: number[] = [];
  for (let at = from; at <= to + 1e-9; at += step) values.push(at);
  return values;
};

/**
 * Paints the numbered grid on `canvas`, sized to the surface's bleed box. The grid lies on the
 * surface (`u` along the print, `v` down it), so on the product each number reads upright there, and a cell is 50 mm
 * down the wall everywhere but 50 mm across only at mid-height of a tapered cup (the surface's `u` is
 * arc length at the mid radius: wider towards the rim, narrower towards the base; a bag face and a
 * straight cup are true squares), whatever way the flat sheet turns it; on a cup's flat sheet the
 * lines bend. The trim, the safe line and the bleed are drawn too, with a heavy mark on the top
 * edge and one on the left edge (a cup's seam, where the glue flap lies past the print).
 */
export function drawGridTexture(
  canvas: HTMLCanvasElement,
  surface: PrintSurface,
  { pxPerMm, colors, seamAtMm }: GridOptions,
): void {
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  const width = Math.ceil(surface.flatBounds.width * pxPerMm);
  const height = Math.ceil(surface.flatBounds.height * pxPerMm);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(pxPerMm, 0, 0, pxPerMm, 0, 0);
  ctx.lineJoin = "round";

  const [u0, u1] = surface.uRange;
  const [v0, v1] = surface.vRange;
  const printedEnd = seamAtMm ?? u1;
  const us = range(u0, u1, GRID_STEP_MM);
  const vs = range(v0, v1, GRID_STEP_MM);

  const line = (points: [number, number][]) => {
    ctx.beginPath();
    points.forEach(([u, v], i) => {
      const { x, y } = surface.toFlat(u, v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  const alongV = (u: number) => range(v0, v1, GRID.sampleMm).map((v): [number, number] => [u, v]);
  const alongU = (v: number, from: number, to: number) =>
    range(from, to, GRID.sampleMm).map((u): [number, number] => [u, v]);

  // Grid lines: the minor ones first so a heavy line is never covered.
  for (const heavy of [false, true]) {
    ctx.strokeStyle = heavy ? colors.major : colors.minor;
    ctx.lineWidth = heavy ? GRID.lineMajorMm : GRID.lineMinorMm;
    const isHeavy = (i: number) => (i * GRID_STEP_MM) % GRID_CELL_MM === 0;
    us.forEach((u, i) => isHeavy(i) === heavy && line(alongV(u)));
    vs.forEach((v, i) => isHeavy(i) === heavy && line(alongU(v, u0, u1)));
  }

  // The print's outlines: bleed, trim, safe.
  ctx.lineWidth = GRID.lineGuideMm;
  for (const [region, color] of [
    ["bleed", colors.bleed],
    ["trim", colors.trim],
    ["safe", colors.safe],
  ] as const) {
    ctx.strokeStyle = color;
    tracePath(ctx, surface.outline(region));
    ctx.stroke();
  }

  // The top edge and the left edge, heavy; the glue flap of a cup is marked where it starts.
  ctx.lineWidth = GRID.lineEdgeMm;
  ctx.strokeStyle = colors.top;
  line(alongU(v0, u0, printedEnd));
  ctx.strokeStyle = colors.left;
  line(alongV(u0));
  if (seamAtMm !== null) line(alongV(seamAtMm));

  // Text reads upright on the product: turned by the direction "up" has on the sheet there.
  const note = (text: string, u: number, v: number, extraTurnRad: number, size: number) => {
    const at = surface.toFlat(u, v);
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(at.uprightRad + extraTurnRad);
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = GRID.labelHaloMm;
    ctx.strokeStyle = colors.paper;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = colors.number;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };

  const columns = Math.ceil((printedEnd - u0) / GRID_CELL_MM);
  const rows = Math.ceil((v1 - v0) / GRID_CELL_MM);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // A cell cut by the print's edge is numbered at the middle of the part that is printed.
      const uFrom = u0 + column * GRID_CELL_MM;
      const vFrom = v0 + row * GRID_CELL_MM;
      const uTo = Math.min(uFrom + GRID_CELL_MM, printedEnd);
      const vTo = Math.min(vFrom + GRID_CELL_MM, v1);
      const number = String(row * columns + column + 1);
      note(number, (uFrom + uTo) / 2, (vFrom + vTo) / 2, 0, GRID.labelMm);
    }
  }

  const middleU = (u0 + printedEnd) / 2;
  const middleV = (v0 + v1) / 2;
  note(LABELS.topEdge, middleU, v0 + GRID.edgeLabelInsetMm, 0, GRID.edgeLabelMm);
  note(
    seamAtMm === null ? LABELS.leftEdge : LABELS.leftEdgeSeam,
    u0 + GRID.edgeLabelInsetMm,
    middleV,
    -Math.PI / 2,
    GRID.edgeLabelMm,
  );
  if (seamAtMm !== null) {
    note(LABELS.glueFlap, (seamAtMm + u1) / 2, middleV, -Math.PI / 2, GRID.edgeLabelMm);
  }
}
