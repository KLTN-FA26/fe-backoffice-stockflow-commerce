// Ported from stockflow-storefront src/features/product-design/engine/surfaces/index.ts
// and surfaces/bag.ts (`createBagSurface`).
import { createCupSurface } from "./surface-cup";
import { createRectSurface } from "./surface-rect";

import type { CustomizationTemplate, PrintArea, PrintAreaCode, ProductModel } from "./model-types";
import type { PrintSurface, SurfaceSet } from "./surface-types";

/** A bag face: `u = x`, `v = y` from the trim's top-left; gussets get a centre crease guide. */
export function createBagSurface(area: PrintArea): PrintSurface {
  return createRectSurface({
    code: area.code,
    widthMm: area.widthMm,
    heightMm: area.heightMm,
    bleedMm: area.bleedMm,
    safeMarginMm: area.safeMarginMm,
    vOffsetMm: 0,
    seamMm: 0,
    crease: area.code === "LEFT" || area.code === "RIGHT",
  });
}

function createSurface(model: ProductModel, area: PrintArea): PrintSurface {
  switch (model.kind) {
    case "parametric-cup":
      return createCupSurface(model, area);
    case "parametric-bag":
      return createBagSurface(area);
    case "gltf":
      throw new Error(`glTF templates are not enabled yet (print area ${area.code})`);
  }
}

/** One print surface per print area, in `printAreas` order. */
export function createSurfaces(template: CustomizationTemplate): SurfaceSet {
  const byCode: Partial<Record<PrintAreaCode, PrintSurface>> = {};
  for (const area of template.printAreas) {
    byCode[area.code] = createSurface(template.model, area);
  }
  return { order: template.printAreas.map((area) => area.code), byCode };
}
