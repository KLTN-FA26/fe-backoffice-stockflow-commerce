// Ported from stockflow-storefront src/features/product-design/engine/model3d/measure-types.ts
import { MODEL3D_MODEL_DEFAULTS } from "@/constants/numbers";

import type { BagModel, CupModel } from "./model-types";

/** What a model cannot tell: the glue seam, the stock and the handle come from the caller. */
export type ModelDefaults = {
  seamMm: number;
  /** only shapes the rim of the number-built fallback model */
  rimMm: number;
  cupMaterial: CupModel["material"];
  bagMaterial: BagModel["material"];
  handle: BagModel["handle"];
};

export const DEFAULT_MODEL_DEFAULTS: ModelDefaults = {
  seamMm: MODEL3D_MODEL_DEFAULTS.seamMm,
  rimMm: MODEL3D_MODEL_DEFAULTS.rimMm,
  cupMaterial: "paper-white",
  bagMaterial: "kraft-brown",
  handle: "twisted",
};

export const BAG_CODES = ["FRONT", "BACK", "LEFT", "RIGHT"] as const;
export type BagCode = (typeof BAG_CODES)[number];

/** A cup body measured on its own: the rings of the band, in world millimetres. */
export type BandShape = {
  kind: "band";
  topDiameterMm: number;
  bottomDiameterMm: number;
  topYMm: number;
  bottomYMm: number;
};

/** A bag face measured on its own; `offsetMm` is its plane on its axis (z for FRONT/BACK, x for LEFT/RIGHT). */
export type FaceShape = {
  kind: "face";
  widthMm: number;
  heightMm: number;
  bottomYMm: number;
  offsetMm: number;
  /** signed world position of the face's centre along its width axis (x for FRONT/BACK, z for LEFT/RIGHT) */
  centreMm: number;
};

export type PrintShape = BandShape | FaceShape;

export const round2 = (n: number) => Math.round(n * 100) / 100;
