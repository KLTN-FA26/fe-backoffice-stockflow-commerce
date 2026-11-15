/** Shared data of the print configuration tests (the sample cup of `model3d/sample-cup.test.ts`). */
import type { CupModel } from "./model3d";
import type { PrintConfigBody, PrintConfigDto, StoredPrintConfig } from "./types";

export const CUP: CupModel = {
  kind: "parametric-cup",
  topDiameterMm: 90,
  bottomDiameterMm: 60,
  heightMm: 110,
  rimMm: 3,
  seamMm: 8,
  bandTopOffsetMm: 6,
  bandBottomOffsetMm: 8,
  material: "paper-white",
};

export const SHA_A = "a".repeat(64);
export const SHA_B = "b".repeat(64);

const FACES = ["FRONT", "BACK", "LEFT", "RIGHT"] as const;

export const CUP_BODY: PrintConfigBody = {
  code: "CUP12-BODY",
  name: "Ly giấy 12oz - thân ly",
  minDpi: 300,
  colorMode: "CMYK",
  allowedFileFormats: ["image/png", "image/jpeg"],
  maxFileSizeMb: 50,
  maxColors: null,
  allowedFontCodes: null,
  model: CUP,
  printAreas: [{ code: "BODY", name: "Thân ly", safeMarginMm: 3, bleedMm: 2 }],
  surfaces: [{ printAreaCode: "BODY", meshName: "print:BODY" }],
};

export const BAG_BODY: PrintConfigBody = {
  ...CUP_BODY,
  code: "BAG-KRAFT",
  model: {
    kind: "parametric-bag",
    widthMm: 240,
    gussetMm: 110,
    heightMm: 310,
    topFoldMm: 30,
    handle: "twisted",
    material: "kraft-brown",
  },
  printAreas: FACES.map((code) => ({ code, name: code, safeMarginMm: 5, bleedMm: 3 })),
  surfaces: FACES.map((code) => ({ printAreaCode: code, meshName: `print:${code}` })),
};

export const storedWith = (modelFileChecksum: string | null): StoredPrintConfig => ({
  templateId: "tpl-1",
  version: 3,
  model: CUP,
  modelFileChecksum,
});

export const glb = (name = "cup.glb", size = 16) => new File([new Uint8Array(size)], name);

/** A BE answer for a stored cup template, as it arrives on the wire (nulls omitted). */
export const cupWire = {
  templateId: "tpl-1",
  productId: "PRD-001",
  variantId: "SKU-001-WHT-L",
  sku: "SKU-001-WHT-L",
  code: "CUP12-BODY",
  name: "Ly giấy 12oz - thân ly",
  minDpi: 300,
  colorMode: "CMYK",
  allowedFileFormats: ["image/png"],
  maxFileSizeMb: 50,
  active: true,
  model: CUP,
  printAreas: [
    {
      code: "BODY",
      name: "Thân ly",
      xMm: 0,
      yMm: 0,
      widthMm: 279.67,
      heightMm: 120.85,
      safeMarginMm: 3,
      bleedMm: 2,
      shape: {
        type: "annular-sector" as const,
        innerRadiusMm: 230.04,
        outerRadiusMm: 327.05,
        sweepRad: 0.84894,
        seamMm: 8,
      },
      uvMapping: { meshPart: "print:BODY" },
    },
  ],
  version: 3,
};

/** `cupWire` parsed the way the API layer does, with `extra` fields on top (a typed DTO for selector tests). */
export const cupDto = (extra: Partial<PrintConfigDto> = {}): PrintConfigDto => ({
  ...cupWire,
  colorMode: "CMYK",
  model: CUP,
  maxColors: null,
  allowedFontCodes: null,
  referenceFileName: null,
  model3d: null,
  modelFileChecksum: null,
  printAreas: [
    {
      ...cupWire.printAreas[0],
      code: "BODY" as const,
    },
  ],
  ...extra,
});

/** A `.glb` as the screen hands it to a save: the name and the exact bytes that were measured. */
export const glbBytes = (name = "cup.glb", size = 16) => ({
  name,
  bytes: new Uint8Array(size).fill(7).buffer,
});
