// Test helper, not shipped code. Ported from stockflow-storefront
// src/features/product-design/engine/__tests__/fixtures.ts (`cup12oz`, `bagM`, `cupBody`, `bagFront`).
import { createSurfaces } from "../surfaces";

import type { CustomizationTemplate, PrintArea } from "../model-types";

/**
 * The spec §4.3 worked example: a conical 12 oz paper cup whose body band unrolls into an annular
 * sector (trim radii 230.04–327.05 mm).
 */
export const cup12oz: CustomizationTemplate = {
  templateId: "tpl-cup12-body",
  code: "CUP12-BODY",
  name: "Ly giấy 12oz – in thân ly",
  sku: "CUP-PAPER-12OZ-WHT",
  minDpi: 300,
  colorMode: "RGB",
  allowedFileFormats: ["image/png", "image/jpeg", "image/webp"],
  maxFileSizeMb: 20,
  maxColors: null,
  allowedFontCodes: null,
  model: {
    kind: "parametric-cup",
    topDiameterMm: 90,
    bottomDiameterMm: 60,
    heightMm: 110,
    rimMm: 3,
    seamMm: 8,
    bandTopOffsetMm: 6,
    bandBottomOffsetMm: 8,
    material: "paper-white",
  },
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
        type: "annular-sector",
        innerRadiusMm: 230.04,
        outerRadiusMm: 327.05,
        sweepRad: 0.84894,
        seamMm: 8,
      },
      uvMapping: { meshPart: "body" },
    },
  ],
};

function bagFace(code: PrintArea["code"], name: string, widthMm: number): PrintArea {
  return {
    code,
    name,
    xMm: 0,
    yMm: 0,
    widthMm,
    heightMm: 280,
    safeMarginMm: 5,
    bleedMm: 3,
    shape: { type: "rect" },
    uvMapping: { meshPart: code.toLowerCase() },
  };
}

/** Medium kraft bag printed on all four faces; printable height = 320 − 40 mm top fold. */
export const bagM: CustomizationTemplate = {
  templateId: "tpl-bagm-4f",
  code: "BAGM-4F",
  name: "Túi kraft size M – in 4 mặt",
  sku: "BAG-KRAFT-M",
  minDpi: 300,
  colorMode: "RGB",
  allowedFileFormats: ["image/png", "image/jpeg", "image/webp"],
  maxFileSizeMb: 20,
  maxColors: null,
  allowedFontCodes: null,
  model: {
    kind: "parametric-bag",
    widthMm: 260,
    gussetMm: 120,
    heightMm: 320,
    topFoldMm: 40,
    handle: "twisted",
    material: "kraft-brown",
  },
  printAreas: [
    bagFace("FRONT", "Mặt trước", 260),
    bagFace("BACK", "Mặt sau", 260),
    bagFace("LEFT", "Hông trái", 120),
    bagFace("RIGHT", "Hông phải", 120),
  ],
};

function surfaceOf(template: CustomizationTemplate, code: PrintArea["code"]) {
  const surface = createSurfaces(template).byCode[code];
  if (!surface) throw new Error(`The fixture template has no ${code} surface`);
  return surface;
}

export const bagFront = surfaceOf(bagM, "FRONT");
export const cupBody = surfaceOf(cup12oz, "BODY");
