/**
 * A paper bag's print file as the workshop prints it: one flat sheet, die-cut, folded into a tube, glued along its
 * glue flap and folded at the bottom (storefront spec 2026-11-18 §3). Figure for figure the BE's `BagSheet`
 * (origin/develop 3672ffb7) and the storefront's `bagSheet()` (PR #53), pinned by the same example in all three test
 * suites: the BE refuses a print file whose sheet differs from its own by more than half a millimetre. Pure.
 *
 * With `W` the width, `g` the gusset, `T` the top fold, `G` the glue flap, `B` the bottom fold,
 * `P = round2(H) − round2(T)` the printed height of a side and `b` the largest bleed of the four print areas:
 * the trim is `Wt = G + 2W + 2g` × `Ht = T + P + B`, the bleed box `(Wt + 2b) × (Ht + 2b)` with the trim at `(b, b)`,
 * and the sides FRONT `(G, T)`, RIGHT `(G + W, T)`, BACK `(G + W + g, T)`, LEFT `(G + 2W + g, T)`. Coordinates are
 * millimetres from the trim's top-left, y down.
 */
import { BAG_SHEET_LIMITS } from "@/constants/numbers";

import type { BagModel } from "./model3d/model-types";

/** The sides in the order they lie on the sheet after the glue flap (BE `BagSheet.SIDES`). */
export const BAG_SHEET_SIDES = ["FRONT", "RIGHT", "BACK", "LEFT"] as const;
export type BagSheetSide = (typeof BAG_SHEET_SIDES)[number];

export interface SheetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BagSheet {
  glueFlapMm: number;
  widthMm: number;
  gussetMm: number;
  topFoldMm: number;
  /** `P`: the printed height of a side. */
  printedHeightMm: number;
  bottomFoldMm: number;
  /** `b`: the largest bleed of the four print areas. */
  bleedMm: number;
  trimWidthMm: number;
  trimHeightMm: number;
  bleedWidthMm: number;
  bleedHeightMm: number;
  /** The model gave no glue flap or bottom fold: the defaults stand in, as the BE fills them (an assumption). */
  assumed: boolean;
  /** Each side's trim on the sheet, from the trim's top-left. */
  sides: Record<BagSheetSide, SheetRect>;
  /** Folds as distances from the trim's left (vertical) or top (horizontal) edge. */
  verticalFolds: number[];
  horizontalFolds: number[];
  /** Column widths left to right: glue flap, FRONT, RIGHT, BACK, LEFT. */
  columnsMm: number[];
  /** Row heights top to bottom: top fold, printed sides, bottom fold. */
  rowsMm: number[];
}

/** Millimetres to hundredths, half up, as the BE's `round2` and the template's columns keep them. */
const round2 = (mm: number): number => Math.round(mm * 100) / 100;

/** `round2(0.6 × gusset)`: the bottom fold of a bag that does not say (BE `BagModel.defaultBottomFoldMm`). */
export const defaultBottomFoldMm = (gussetMm: number): number =>
  round2(BAG_SHEET_LIMITS.bottomFoldShare * gussetMm);

/** The sheet of `model`, whose sides are `areas` (only their bleed counts here). */
export function bagSheet(model: BagModel, areas: readonly { bleedMm: number }[]): BagSheet {
  const G = model.glueFlapMm ?? BAG_SHEET_LIMITS.glueFlapDefaultMm;
  const B = model.bottomFoldMm ?? defaultBottomFoldMm(model.gussetMm);
  const { widthMm: W, gussetMm: g, topFoldMm: T } = model;
  const P = round2(model.heightMm) - round2(T);
  const b = areas.reduce((most, area) => Math.max(most, area.bleedMm), 0);
  const trimWidthMm = G + 2 * W + 2 * g;
  const trimHeightMm = T + P + B;
  const side = (x: number, width: number): SheetRect => ({ x, y: T, width, height: P });
  return {
    glueFlapMm: G,
    widthMm: W,
    gussetMm: g,
    topFoldMm: T,
    printedHeightMm: P,
    bottomFoldMm: B,
    bleedMm: b,
    trimWidthMm,
    trimHeightMm,
    bleedWidthMm: trimWidthMm + 2 * b,
    bleedHeightMm: trimHeightMm + 2 * b,
    assumed: model.glueFlapMm === undefined || model.bottomFoldMm === undefined,
    sides: {
      FRONT: side(G, W),
      RIGHT: side(G + W, g),
      BACK: side(G + W + g, W),
      LEFT: side(G + 2 * W + g, g),
    },
    verticalFolds: [G, G + W, G + W + g / 2, G + W + g, G + 2 * W + g, G + 2 * W + 1.5 * g],
    horizontalFolds: [T, T + P],
    columnsMm: [G, W, g, W, g],
    rowsMm: [T, P, B],
  };
}
