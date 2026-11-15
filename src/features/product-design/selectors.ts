/** Pure helpers the print configuration screen needs. */
import { PRINT_CONFIG_FIGURE_LABELS } from "@/constants/labels-print-config";

import { measuredFigures } from "./measured";

import type { PrintAreaCode } from "./model3d";
import type { PrintConfigDto, PrintSurface, StoredPrintConfig } from "./types";

type ModelOf = NonNullable<PrintConfigDto["model"]>;

/** Does the variant have a configuration with a 3D model file? (B-3: `model3d` is null without one.) */
export const hasModel = (config: PrintConfigDto | null | undefined): boolean =>
  Boolean(config?.model3d);

/** Print areas of the configuration that the area ↔ mesh table does not cover (all of them without a model). */
export function printAreasWithoutMesh(config: PrintConfigDto): PrintAreaCode[] {
  const covered = new Set(config.model3d?.surfaces.map((surface) => surface.printAreaCode));
  return config.printAreas.map((area) => area.code).filter((code) => !covered.has(code));
}

/** The table for a set of print areas by the naming convention: the mesh of area `X` is `print:X`. */
export const defaultSurfaces = (codes: readonly PrintAreaCode[]): PrintSurface[] =>
  codes.map((code) => ({ printAreaCode: code, meshName: `print:${code}` }));

export interface FigureRow {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit: "mm";
}

/** Rows of the measured figures (the ones the `.glb` decides), for display. */
export const figureRows = (model: ModelOf): FigureRow[] =>
  measuredFigures(model).map(({ key, value }) => ({
    key,
    label: PRINT_CONFIG_FIGURE_LABELS[key],
    value,
    unit: "mm",
  }));

/** What a save needs to know of the configuration it starts from (B-6). */
export const storedOf = (config: PrintConfigDto): StoredPrintConfig => ({
  templateId: config.templateId,
  version: config.version,
  model: config.model,
  modelFileChecksum: config.modelFileChecksum,
});
