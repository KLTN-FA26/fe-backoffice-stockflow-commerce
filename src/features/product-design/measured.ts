/**
 * The figures of a model that come from measuring the `.glb` (cup: mouth and base diameters, height, the print band's
 * distance to mouth and base; bag: width, gusset, height). The rest of the model (seam, rim, top fold, handle,
 * material) is edited freely. Source: yêu cầu BE B-6.
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

/** True when `next` differs from `previous` in kind or in any measured figure. */
export function measuredChanged(previous: MeasuredModel, next: MeasuredModel): boolean {
  if (previous.kind !== next.kind) return true;
  const before = measuredFigures(previous);
  return measuredFigures(next).some((figure, i) => figure.value !== before[i]?.value);
}
