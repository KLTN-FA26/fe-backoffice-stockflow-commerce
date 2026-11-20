/**
 * A failed save as the screen shows it: the feature's mapped sentence (`printConfigErrorMessage`, never the BE's
 * English), plus the form fields the server named. Server field names are matched explicitly; any other name goes to
 * the general sentence only (api/error.ts).
 */
import {
  PRINT_CONFIG_SCREEN_LABELS,
  PRINT_CONFIG_SURFACE_ERROR_MESSAGES as SURFACE_MESSAGES,
} from "@/constants/labels-print-config";
import { ApiError } from "@/lib/api/error";

import { printConfigErrorMessage } from "../errors";

import type { ApiFieldErrorBody } from "@/lib/api/error";
import type { PrintConfigErrorContext } from "../errors";
import type { PrintConfigBody } from "../types";
import type { ModelKind, PrintDefaultsValues } from "./print-defaults";

export interface SaveErrorView {
  general: string;
  fields: { field: keyof PrintDefaultsValues; message: string }[];
}

/** BE field path (`printAreas[0].safeMarginMm`, `model.seamMm`, …) → the form field it belongs to. */
function formFieldOf(path: string, kind: ModelKind | null): keyof PrintDefaultsValues | null {
  const name = (path.split(".").pop() ?? path).replace(/\[\d+\]$/, "");
  switch (name) {
    case "minDpi":
    case "colorMode":
    case "allowedFileFormats":
    case "maxFileSizeMb":
    case "maxColors":
    case "allowedFontCodes":
    case "safeMarginMm":
    case "bleedMm":
    case "seamMm":
    case "rimMm":
    case "topFoldMm":
    case "glueFlapMm":
    case "bottomFoldMm":
    case "handle":
      return name;
    case "material":
      return kind === "parametric-bag" ? "bagMaterial" : "cupMaterial";
    default:
      return null;
  }
}

type Sent = Pick<PrintConfigBody, "printAreas" | "surfaces">;

/**
 * One 422 PRINT_CONFIG_SURFACES_INVALID field error (`fieldErrors[]` with its `code`) → a sentence naming its print
 * area. `model3d.surfaces[i]` is row `i` of the table the save sent; `PrintAreaMissing` (field `model3d.surfaces`, no
 * row) names the areas the sent table left out.
 */
function surfaceLines(field: string, code: string | undefined, sent: Sent): string[] {
  if (field === "model3d.surfaces" && code === "PrintAreaMissing") {
    const mapped = new Set(sent.surfaces.map((s) => s.printAreaCode));
    const missing = sent.printAreas.map((a) => a.code).filter((c) => !mapped.has(c));
    return missing.length > 0
      ? missing.map((c) => SURFACE_MESSAGES.PrintAreaMissing(c))
      : [SURFACE_MESSAGES.missingUnnamed];
  }
  const row = /^model3d\.surfaces\[(\d+)\]\.(printAreaCode|meshName)$/.exec(field);
  if (!row) return [];
  const index = Number(row[1]);
  const area = sent.surfaces[index]?.printAreaCode;
  if (!area) return [SURFACE_MESSAGES.unknownRow(index)];
  switch (code) {
    case "MeshNameMismatch":
    case "PrintAreaUnknown":
    case "PrintAreaDuplicate":
    case "Size":
      return [SURFACE_MESSAGES[code](area)];
    default:
      return [SURFACE_MESSAGES.unknownRow(index)];
  }
}

/**
 * `sent` is what the failed save sent: it names the print area behind each `model3d.surfaces[i]` field error (the table
 * is derived from the file, so those rows are not form fields: their sentences join the general one). `context` picks
 * the words for a create (a file is required to create) or an update.
 */
export function saveErrorView(
  error: unknown,
  kind: ModelKind | null,
  sent: Sent = { printAreas: [], surfaces: [] },
  context: PrintConfigErrorContext = "update",
): SaveErrorView {
  const fields: SaveErrorView["fields"] = [];
  const lines: string[] = [];
  if (error instanceof ApiError) {
    const list: readonly ApiFieldErrorBody[] =
      error.fieldErrorList ??
      Object.entries(error.fieldErrors ?? {}).map(([field, message]) => ({ field, message }));
    for (const entry of list) {
      for (const line of surfaceLines(entry.field, entry.code, sent)) {
        if (!lines.includes(line)) lines.push(line);
      }
      const field = formFieldOf(entry.field, kind);
      if (field && !fields.some((f) => f.field === field)) {
        fields.push({ field, message: PRINT_CONFIG_SCREEN_LABELS.serverField });
      }
    }
  }
  return { general: [printConfigErrorMessage(error, context), ...lines].join(" "), fields };
}
