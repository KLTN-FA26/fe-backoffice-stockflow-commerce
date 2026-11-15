/**
 * A failed save as the screen shows it: the feature's mapped sentence (`printConfigErrorMessage`, never the BE's
 * English), plus the form fields the server named. Server field names are matched explicitly; any other name goes to
 * the general sentence only (api/error.ts).
 */
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { ApiError } from "@/lib/api/error";

import { printConfigErrorMessage } from "../errors";

import type { ModelKind, PrintDefaultsValues } from "./print-defaults";

export interface SaveErrorView {
  general: string;
  fields: { field: keyof PrintDefaultsValues; message: string }[];
}

/** BE field path (`printAreas[0].safeMarginMm`, `model.seamMm`, …) → the form field it belongs to. */
function formFieldOf(path: string, kind: ModelKind | null): keyof PrintDefaultsValues | null {
  const name = path.split(".").pop() ?? path;
  switch (name) {
    case "safeMarginMm":
    case "bleedMm":
    case "seamMm":
    case "rimMm":
    case "topFoldMm":
    case "handle":
      return name;
    case "material":
      return kind === "parametric-bag" ? "bagMaterial" : "cupMaterial";
    default:
      return null;
  }
}

export function saveErrorView(error: unknown, kind: ModelKind | null): SaveErrorView {
  const fields: SaveErrorView["fields"] = [];
  if (error instanceof ApiError) {
    for (const path of Object.keys(error.fieldErrors ?? {})) {
      const field = formFieldOf(path, kind);
      if (field) fields.push({ field, message: PRINT_CONFIG_SCREEN_LABELS.serverField });
    }
  }
  return { general: printConfigErrorMessage(error), fields };
}
