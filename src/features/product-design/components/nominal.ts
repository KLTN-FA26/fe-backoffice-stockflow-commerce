/** The manufacturer's figures the person may type to cross-check the file (optional, never block a save). */
import type { NominalSizes } from "../model3d/issues";

export type NominalKey = keyof NominalSizes;
export type NominalText = Partial<Record<NominalKey, string>>;

/** The figures a kind can be cross-checked on, in the order they are asked. */
export const NOMINAL_KEYS: Record<"cup" | "bag", readonly NominalKey[]> = {
  cup: ["topDiameterMm", "bottomDiameterMm", "heightMm"],
  bag: ["widthMm", "gussetMm", "heightMm"],
};

/** The typed figures as numbers: blank ones are left out, others must be positive numbers (comma or dot). */
export function parseNominal(text: NominalText): {
  nominal: NominalSizes;
  invalid: Set<NominalKey>;
} {
  const nominal: NominalSizes = {};
  const invalid = new Set<NominalKey>();
  for (const key of Object.keys(text) as NominalKey[]) {
    const trimmed = (text[key] ?? "").trim();
    if (trimmed === "") continue;
    const value = Number(trimmed.replace(",", "."));
    if (Number.isFinite(value) && value > 0) nominal[key] = value;
    else invalid.add(key);
  }
  return { nominal, invalid };
}
