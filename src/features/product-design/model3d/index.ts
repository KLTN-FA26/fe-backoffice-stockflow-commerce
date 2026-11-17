// Public surface of the 3D model measuring and checking code (ported from the storefront's engine/model3d).
export { compareWithNominal, MODEL_ISSUE_LEVEL, modelIssue } from "./issues";
export type { ModelIssue, ModelIssueCode, NominalSizes } from "./issues";
export { templateDifferences } from "./compare-template";
export type { PrintTarget } from "./compare-template";
export {
  bandVRangeOf,
  cupSector,
  cupSlantMm,
  isCylindricalCup,
  printedWidthMm,
  straightBandOf,
  trimBoundsOf,
} from "./cup-sector";
export type { CupSector } from "./cup-sector";
export { disposeGlbTree } from "./dispose";
export { findNearMissNames, findPrintObjects } from "./find-print-meshes";
export type { PrintObject } from "./find-print-meshes";
export { BYTE_LENGTH_KEY, loadGlb } from "./load";
export { measureModel } from "./measure";
export type { ModelMeasurement, PrintMeshInfo } from "./measure";
export { DEFAULT_MODEL_DEFAULTS } from "./measure-types";
export type { BandShape, FaceShape, ModelDefaults, PrintShape } from "./measure-types";
export {
  bagModelSchema,
  customizationTemplateSchema,
  cupModelSchema,
  printAreaCodeSchema,
  printAreaSchema,
  productModelSchema,
} from "./model-types";
export type {
  BagModel,
  CupModel,
  CustomizationTemplate,
  PrintArea,
  PrintAreaCode,
  ProductModel,
} from "./model-types";
export { Model3dError } from "./model3d-error";
export type { Model3dErrorCode, Model3dLoadReason } from "./model3d-error";
export { DEFAULT_TEMPLATE_DEFAULTS, templateFromModel } from "./template-from-model";
export type { TemplateDefaults } from "./template-from-model";
export { readGridColors } from "./grid-colors";
export { drawGridTexture, GRID_CELL_MM, GRID_STEP_MM, gridPxPerMm } from "./grid-texture";
export type { GridColors, GridOptions } from "./grid-texture";
export { printGeometry } from "./print-uv";
export { createBagSurface, createSurfaces } from "./surfaces";
export { createCupSurface } from "./surface-cup";
export type {
  FlatPoint,
  PathCmd,
  PrintSurface,
  SurfacePoint,
  SurfaceRegion,
  SurfaceSet,
  SurfaceTarget,
} from "./surface-types";
