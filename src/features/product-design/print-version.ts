/**
 * Does a save change the "print version" of a configuration? Pure.
 *
 * BE (WF-02 decision 1, `printVersion`): a design in review is compared with the print version it was made on, so a
 * save that moves it makes every `PENDING_REVIEW` design on the configuration un-reviewable (the customer must resubmit).
 * What belongs to it: the model and the print areas (position, size, safe margin, bleed, shape, mesh part), the minimum
 * dpi, colour mode, file formats, maximum file size, maximum colours, the allowed fonts, and the 3D model file with its
 * area ↔ mesh table. What does not: the configuration's name and the print areas' names.
 *
 * Lists compare in order, as the BE's `PrintFacts` record does (`List.equals`): the same formats, fonts, areas or mesh
 * rows in another order are a change there, so they are one here (the pickers keep the canonical order, so an untouched
 * list never warns).
 */
import type { PrintConfigBody, PrintConfigDto } from "./types";

/** Structural equality of plain JSON values (key order does not matter). */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => sameJson(item, b[i]))
    );
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => sameJson(left[key], right[key]));
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, i) => item === b[i]);

/** `null` (every font) differs from any list. */
const sameOptionalList = (a: readonly string[] | null, b: readonly string[] | null) =>
  a === null || b === null ? a === b : sameList(a, b);

/**
 * `true` when saving `values` over `stored` changes a print-version field. `newFile`: a `.glb` is sent with the save
 * (a new file and its mesh map always count, even if the bytes were the same).
 */
export function changesPrintVersion(
  stored: PrintConfigDto,
  values: PrintConfigBody,
  newFile: boolean,
): boolean {
  if (newFile) return true;
  if (
    stored.minDpi !== values.minDpi ||
    stored.colorMode !== values.colorMode ||
    stored.maxFileSizeMb !== values.maxFileSizeMb ||
    stored.maxColors !== values.maxColors ||
    !sameList(stored.allowedFileFormats, values.allowedFileFormats) ||
    !sameOptionalList(stored.allowedFontCodes, values.allowedFontCodes)
  ) {
    return true;
  }
  if (!sameJson(stored.model, values.model)) return true;
  // Print areas: the codes and the margins the form sends (position, size and shape follow from the model and margins).
  const areas = stored.printAreas;
  const sent = values.printAreas;
  if (
    areas.length !== sent.length ||
    areas.some(
      (area, i) =>
        area.code !== sent[i]?.code ||
        area.safeMarginMm !== sent[i]?.safeMarginMm ||
        area.bleedMm !== sent[i]?.bleedMm,
    )
  ) {
    return true;
  }
  return !sameJson(stored.model3d.surfaces, values.surfaces);
}
