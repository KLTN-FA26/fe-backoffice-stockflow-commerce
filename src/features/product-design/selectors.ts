/** Pure helpers the print configuration screen needs. */
import { PRINT_CONFIG_FIGURE_LABELS } from "@/constants/labels-print-config";

import { measuredFigures } from "./measured";
import { surfaceFaults } from "./surfaces";

import type { SurfaceFault } from "./surfaces";
import type { PrintConfigDto, StoredPrintConfig } from "./types";

type ModelOf = NonNullable<PrintConfigDto["model"]>;

/** Does the configuration have a 3D model file attached? (BE `model3d.hasFile`; `model3d` itself is always present.) */
export const hasModel = (config: PrintConfigDto | null | undefined): boolean =>
  config?.model3d.hasFile === true;

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

/** What a save needs to know of the configuration it starts from. */
export const storedOf = (config: PrintConfigDto): StoredPrintConfig => ({
  templateId: config.templateId,
  version: config.version,
  model: config.model,
  hasFile: config.model3d.hasFile,
  surfaces: config.model3d.surfaces,
});

/**
 * Where a stored configuration stands with its `.glb` (BE `PrintConfigService`, origin/develop d47ed4ae), which decides
 * what may be saved without a new file and whether it may be activated:
 *  - `ready`: a file and a complete table; free edits without a file, activation allowed;
 *  - `no-file`: written before files were required; free edits only (`ModelFileRules`), no activation (409);
 *  - `no-model`: written before templates had a model; any save without a file changes the kind (409), no activation;
 *  - `mapping-broken`: a file, but an area without its `print:<code>` mesh; every save without a new file and the
 *    activation are refused (422) until the file is sent again with a correct table.
 */
export type ModelFileState =
  | { kind: "ready" }
  | { kind: "no-file" }
  | { kind: "no-model" }
  | { kind: "mapping-broken"; faults: SurfaceFault[] };

export function modelFileStateOf(config: PrintConfigDto): ModelFileState {
  if (!config.model) return { kind: "no-model" };
  if (!config.model3d.hasFile) return { kind: "no-file" };
  const codes = config.printAreas.map((area) => area.code);
  const faults = surfaceFaults(codes, config.model3d.surfaces);
  return faults.length > 0 ? { kind: "mapping-broken", faults } : { kind: "ready" };
}

/** A save without a new file can reach the BE (free edits of a `ready` or `no-file` configuration). */
export const editableWithoutFile = (state: ModelFileState): boolean =>
  state.kind === "ready" || state.kind === "no-file";
