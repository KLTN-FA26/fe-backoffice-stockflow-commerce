/**
 * The rules of BE `PrintConfigRules` (origin/develop 3672ffb7) that need the model, checked before a save so the
 * refusal shows on the input that causes it instead of coming back from the server. Pure.
 *
 *  - `measuredFaults`: the figures the file determines (`requireCup` / `requireBag`). No input can fix them: they are
 *    reported as the save's sentence, before anything is sent.
 *  - `geometryFaults`: what the typed seam, margins and top fold do to that model (`cupAreas`, `bagAreas`,
 *    `requireRoom`), on the field the BE names in `fieldErrors`.
 *
 * Storefront spec `2026-11-18-tui-giay-tam-trai-phang.md` §5 (commit 0c4132f) lists them for the back office.
 */
import {
  PRINT_CONFIG_FIGURE_LABELS as FIGURE,
  PRINT_CONFIG_SCHEMA_MESSAGES as M,
  PRINT_CONFIG_SCREEN_LABELS,
} from "@/constants/labels-print-config";
import { PRINT_CONFIG_LIMITS as LIMITS } from "@/constants/numbers";
import { formatFixed } from "@/lib/format";

import { bagHeightFor } from "./measured";
import { cupSector, cupSlantMm, isCylindricalCup, trimBoundsOf } from "./model3d/cup-sector";
import { round2 } from "./model3d/measure-types";

import type { BagModel, CupModel } from "./model3d/model-types";
import type { MeasuredKey } from "./measured";

const V = PRINT_CONFIG_SCREEN_LABELS.advanced.validation;

export interface MeasuredFault {
  key: MeasuredKey;
  message: string;
}

/** The typed values the geometry depends on (the form's, or a print area's with the model's seam and fold). */
export interface GeometryInput {
  seamMm: number;
  topFoldMm: number;
  safeMarginMm: number;
  bleedMm: number;
}

export interface GeometryFault {
  field: "seamMm" | "topFoldMm" | "safeMarginMm" | "bleedMm";
  message: string;
}

/** A strict upper bound shown in hundredths, rounded up: every value of two decimals below it passes. */
const below = (mm: number) => `${formatFixed(Math.ceil(mm * 100 - 1e-9) / 100, 2)} mm`;
/** An inclusive bound shown in hundredths, rounded down: the value shown passes. */
const atMost = (mm: number) => `${formatFixed(Math.floor(mm * 100 + 1e-9) / 100, 2)} mm`;

/** BE `requirePositive`: `0 < value ≤ 2000`; `requireNonNegative`: `0 ≤ value ≤ 2000`. */
function rangeFault(key: MeasuredKey, value: number, positive: boolean): MeasuredFault | null {
  const max = LIMITS.modelFigureMaxMm;
  const low = positive ? !(value > 0) : !(value >= 0);
  if (!low && value <= max) return null;
  const message = positive
    ? M.measuredPositive(FIGURE[key], max)
    : M.measuredNonNegative(FIGURE[key], max);
  return { key, message };
}

function cupFaults(cup: CupModel): MeasuredFault[] {
  const sizes = ["topDiameterMm", "bottomDiameterMm", "heightMm"] as const;
  const offsets = ["bandTopOffsetMm", "bandBottomOffsetMm"] as const;
  const ranged = [
    ...sizes.map((key) => rangeFault(key, cup[key], true)),
    ...offsets.map((key) => rangeFault(key, cup[key], false)),
  ].filter((fault): fault is MeasuredFault => fault !== null);
  if (ranged.length > 0) return ranged;
  // BE `MIN_CUP_DIAMETER_MM`: below 10 mm the cone's apex is too close for the unrolled band to mean anything.
  const small = sizes
    .filter((key) => cup[key] < LIMITS.cupMinSizeMm)
    .map((key) => ({ key, message: M.cupTooSmall(FIGURE[key], LIMITS.cupMinSizeMm) }));
  if (small.length > 0) return small;
  // BE `BaseWiderThanRim`, then `NoBand` (both offset fields named; the screen names the band once).
  if (cup.bottomDiameterMm > cup.topDiameterMm) {
    return [{ key: "bottomDiameterMm", message: M.baseWiderThanRim }];
  }
  if (cup.bandTopOffsetMm + cup.bandBottomOffsetMm >= cupSlantMm(cup)) {
    return [{ key: "bandTopOffsetMm", message: M.noBand }];
  }
  return [];
}

/**
 * The faults of the figures read from the file, in the BE's order. A bag's height is checked by `geometryFaults`
 * (it moves with the typed top fold).
 */
export function measuredFaults(model: CupModel | BagModel): MeasuredFault[] {
  if (model.kind === "parametric-cup") return cupFaults(model);
  return [
    rangeFault("widthMm", model.widthMm, true),
    rangeFault("gussetMm", model.gussetMm, true),
  ].filter((fault): fault is MeasuredFault => fault !== null);
}

/** BE `requireRoom`: the safe area (trim less the margin on each side) keeps room in both directions. */
function roomFault(safeMarginMm: number, sides: readonly number[]): GeometryFault | null {
  const shortest = Math.min(...sides);
  // The BE checks the margin as stored, in hundredths (`PrintConfigRules.mm`).
  if (2 * round2(safeMarginMm) < shortest) return null;
  return { field: "safeMarginMm", message: V.noSafeArea(below(shortest / 2)) };
}

function cupGeometry(cup: CupModel, d: GeometryInput): GeometryFault[] {
  const model = { ...cup, seamMm: d.seamMm };
  const bandHeight = cupSlantMm(model) - model.bandTopOffsetMm - model.bandBottomOffsetMm;
  const box = trimBoundsOf(model);
  if (isCylindricalCup(model)) {
    // BE `cupAreas`, a straight wall: the circumference by the band, then the stored rect (seam included).
    const sides = [
      Math.PI * model.topDiameterMm,
      bandHeight,
      round2(box.width),
      round2(box.height),
    ];
    return [roomFault(d.safeMarginMm, sides)].filter((f): f is GeometryFault => f !== null);
  }
  const s = cupSector(model);
  const faults: GeometryFault[] = [];
  // BE `SeamOverlaps` (field `model.seamMm`): the sweep and the glue flap stay under one full turn.
  const overlaps = !(s.sweepRad + s.seamRad < 2 * Math.PI);
  if (overlaps) {
    faults.push({
      field: "seamMm",
      message: V.seamOverlaps(below((2 * Math.PI - s.sweepRad) * s.trimInnerMm)),
    });
  }
  // BE `BleedPastCentre` (field `printAreas[i].bleedMm`): the bleed ring stops before the sector's apex.
  if (!(s.trimInnerMm - round2(d.bleedMm) > 0)) {
    faults.push({ field: "bleedMm", message: V.bleedPastCentre(below(s.trimInnerMm)) });
  }
  // The box of a band that overlaps itself is meaningless: the BE refuses the seam before measuring it.
  if (!overlaps) {
    const sides = [s.sweepRad * s.trimInnerMm, bandHeight, round2(box.width), round2(box.height)];
    const room = roomFault(d.safeMarginMm, sides);
    if (room) faults.push(room);
  }
  return faults;
}

function bagGeometry(bag: BagModel, d: GeometryInput): GeometryFault[] {
  const faults: GeometryFault[] = [];
  // The sent height is the face plus the typed fold (`bagHeightFor`); BE `requirePositive` caps it at 2000 mm.
  const height = bagHeightFor(bag, d.topFoldMm);
  if (height > LIMITS.modelFigureMaxMm) {
    const limit = atMost(LIMITS.modelFigureMaxMm - (height - d.topFoldMm));
    faults.push({ field: "topFoldMm", message: V.bagTooTall(limit, LIMITS.modelFigureMaxMm) });
  }
  // BE `bagAreas`: FRONT/BACK as wide as the bag, LEFT/RIGHT as its gusset, all as tall as the bag less its fold.
  const printable = round2(height - d.topFoldMm);
  const room = roomFault(d.safeMarginMm, [round2(bag.widthMm), round2(bag.gussetMm), printable]);
  if (room) faults.push(room);
  return faults;
}

/**
 * What the typed values do to `model` (the file's, or the stored one): `[]` when the BE would take them. Nothing is
 * checked on a model the BE refuses for its own figures (`measuredFaults`): it never reaches these rules.
 */
export function geometryFaults(model: CupModel | BagModel, d: GeometryInput): GeometryFault[] {
  if (measuredFaults(model).length > 0) return [];
  return model.kind === "parametric-cup" ? cupGeometry(model, d) : bagGeometry(model, d);
}
