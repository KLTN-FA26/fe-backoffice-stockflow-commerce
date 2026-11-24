/**
 * The values of a print configuration as text, one place for the read-only view and for the "Đang lưu: …" line under a
 * field the person changed in the edit mode, so both say a value the same way.
 */
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";

import { formatMm } from "./format-mm";

import type { ValueRow } from "./default-rows";
import type { PrintDefaultsValues } from "./print-defaults";

const TEXT = PRINT_CONFIG_SCREEN_LABELS;
const RULES = TEXT.summary.rules;

export type RuleField =
  | "minDpi"
  | "maxFileSizeMb"
  | "colorMode"
  | "maxColors"
  | "allowedFileFormats"
  | "allowedFontCodes";

export type FigureField =
  | "safeMarginMm"
  | "bleedMm"
  | "seamMm"
  | "rimMm"
  | "topFoldMm"
  | "glueFlapMm"
  | "bottomFoldMm";

export type ChoiceField = "cupMaterial" | "bagMaterial" | "handle";

const RULE_FIELDS: readonly RuleField[] = [
  "minDpi",
  "maxFileSizeMb",
  "colorMode",
  "maxColors",
  "allowedFileFormats",
  "allowedFontCodes",
];

/** A file rule as text: "300 dpi", "50 MB", "CMYK (in offset)", "Không giới hạn", "PNG, JPG", "Mọi font". */
export function ruleText(field: RuleField, v: PrintDefaultsValues): string {
  switch (field) {
    case "minDpi":
      return TEXT.summary.dpi(v.minDpi);
    case "maxFileSizeMb":
      return TEXT.summary.megabytes(v.maxFileSizeMb);
    case "colorMode":
      return TEXT.fileRules.colorModes[v.colorMode];
    case "maxColors":
      return v.maxColors === null ? TEXT.fileRules.noColorLimit : String(v.maxColors);
    case "allowedFileFormats":
      return v.allowedFileFormats.map((format) => TEXT.fileRules.formats[format]).join(", ");
    case "allowedFontCodes":
      return v.allowedFontCodes === null
        ? TEXT.fileRules.fontsAll
        : TEXT.summary.fontCount(v.allowedFontCodes.length);
  }
}

/** The file rules as label / value rows for the read-only view. */
export const ruleRows = (v: PrintDefaultsValues): ValueRow[] =>
  RULE_FIELDS.map((field) => ({ label: RULES[field], value: ruleText(field, v) }));

/** A value the file cannot tell as text: "8,0 mm", "Giấy trắng", "Quai xoắn". */
export function defaultText(field: FigureField | ChoiceField, v: PrintDefaultsValues): string {
  switch (field) {
    case "cupMaterial":
      return TEXT.advanced.cupMaterials[v.cupMaterial];
    case "bagMaterial":
      return TEXT.advanced.bagMaterials[v.bagMaterial];
    case "handle":
      return TEXT.advanced.handles[v.handle];
    default:
      return formatMm(v[field]);
  }
}

const sameList = (a: readonly string[] | null, b: readonly string[] | null) =>
  a === null || b === null
    ? a === b
    : a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

const isRuleField = (field: string): field is RuleField => RULE_FIELDS.some((f) => f === field);
const isListField = (field: string): field is "allowedFileFormats" | "allowedFontCodes" =>
  field === "allowedFileFormats" || field === "allowedFontCodes";

/**
 * "Đang lưu: …" for a field whose value in the form is not the stored one, else `undefined` (nothing to compare with:
 * no stored configuration, or the field unchanged).
 */
export function savedHint(
  field: RuleField | FigureField | ChoiceField,
  current: Partial<PrintDefaultsValues>,
  saved: PrintDefaultsValues | null,
): string | undefined {
  if (!saved) return undefined;
  const unchanged = isListField(field)
    ? sameList(current[field] ?? null, saved[field])
    : current[field] === saved[field];
  if (unchanged) return undefined;
  return TEXT.savedValue(isRuleField(field) ? ruleText(field, saved) : defaultText(field, saved));
}
