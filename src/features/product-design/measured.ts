/**
 * The values of a template its `.glb` determines (BE `ModelFileRules`, origin/develop d47ed4ae): a cup's mouth and base
 * diameters, height and the print band's distance to mouth and base; a bag's width, gusset and printed height
 * (`heightMm − topFoldMm`, so the top fold may move when the height moves with it); and the model's kind. The rest of the
 * model (seam, rim, top fold, handle, material) is edited freely.
 *
 * A save without a new file must send these values as they were read: the BE compares them in hundredths of a
 * millimetre (`Math.round(mm * 100)`, `ModelFileRules.hundredths`) and answers 409 PRINT_CONFIG_MODEL_FILE_REQUIRED to
 * any difference, including a template written before it had a model (any model is then a change of kind).
 */
import type { BagModel, CupModel } from "./model3d";

type MeasuredModel = CupModel | BagModel;

export type MeasuredKey =
  | "topDiameterMm"
  | "bottomDiameterMm"
  | "heightMm"
  | "bandTopOffsetMm"
  | "bandBottomOffsetMm"
  | "widthMm"
  | "gussetMm";

export interface MeasuredFigure {
  readonly key: MeasuredKey;
  readonly value: number;
}

/** The figures shown as "measured from the file" (a bag's height is shown whole; its fold is a default). */
export function measuredFigures(model: MeasuredModel): readonly MeasuredFigure[] {
  if (model.kind === "parametric-cup") {
    return [
      { key: "topDiameterMm", value: model.topDiameterMm },
      { key: "bottomDiameterMm", value: model.bottomDiameterMm },
      { key: "heightMm", value: model.heightMm },
      { key: "bandTopOffsetMm", value: model.bandTopOffsetMm },
      { key: "bandBottomOffsetMm", value: model.bandBottomOffsetMm },
    ];
  }
  return [
    { key: "widthMm", value: model.widthMm },
    { key: "gussetMm", value: model.gussetMm },
    { key: "heightMm", value: model.heightMm },
  ];
}

/** Millimetres in hundredths, as the BE compares them (`Math.round` rounds half up in Java and in JS alike). */
const hundredths = (mm: number): number => Math.round(mm * 100);

/** A bag's printed height in hundredths: each side rounded first, as the BE does (`ModelFileRules.printedHeight`). */
const printedHeight = (bag: BagModel): number =>
  hundredths(bag.heightMm) - hundredths(bag.topFoldMm);

/**
 * True when `next` changes a value the file determines: another kind (or no stored model at all), or a measured
 * figure that differs in hundredths of a millimetre.
 */
export function measuredChanged(previous: MeasuredModel | null, next: MeasuredModel): boolean {
  if (!previous || previous.kind !== next.kind) return true;
  if (previous.kind === "parametric-cup" && next.kind === "parametric-cup") {
    const keys = [
      "topDiameterMm",
      "bottomDiameterMm",
      "heightMm",
      "bandTopOffsetMm",
      "bandBottomOffsetMm",
    ] as const;
    return keys.some((key) => hundredths(previous[key]) !== hundredths(next[key]));
  }
  if (previous.kind === "parametric-bag" && next.kind === "parametric-bag") {
    return (
      hundredths(previous.widthMm) !== hundredths(next.widthMm) ||
      hundredths(previous.gussetMm) !== hundredths(next.gussetMm) ||
      printedHeight(previous) !== printedHeight(next)
    );
  }
  return true;
}

/**
 * A bag's height for a new top fold, keeping the printed height the BE compares (`heightMm − topFoldMm`, in
 * hundredths). The same fold keeps the height exactly as it was read: no arithmetic, so nothing to re-round.
 */
export function bagHeightFor(bag: BagModel, topFoldMm: number): number {
  if (topFoldMm === bag.topFoldMm) return bag.heightMm;
  return (printedHeight(bag) + hundredths(topFoldMm)) / 100;
}
