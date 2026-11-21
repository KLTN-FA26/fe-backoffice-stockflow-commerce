import { describe, expect, it } from "vitest";

import { changesPrintVersion } from "./print-version";
import { CUP, CUP_BODY, cupDto } from "./test-fixtures";

import type { PrintConfigBody, PrintConfigDto } from "./types";

const stored = (extra: Partial<PrintConfigDto> = {}) =>
  cupDto({ allowedFileFormats: CUP_BODY.allowedFileFormats, ...extra });

/** The body a save sends for an untouched stored configuration. */
const unchanged = (from: PrintConfigDto = stored()): PrintConfigBody => ({
  ...CUP_BODY,
  code: from.code,
  name: from.name,
  minDpi: from.minDpi,
  colorMode: from.colorMode,
  allowedFileFormats: from.allowedFileFormats,
  maxFileSizeMb: from.maxFileSizeMb,
  maxColors: from.maxColors,
  allowedFontCodes: from.allowedFontCodes,
  model: from.model ?? CUP,
  printAreas: from.printAreas.map(({ code, name, safeMarginMm, bleedMm }) => ({
    code,
    name,
    safeMarginMm,
    bleedMm,
  })),
  surfaces: from.model3d.surfaces,
});
const firstArea = (body: PrintConfigBody) => body.printAreas[0] ?? CUP_BODY.printAreas[0]!;

describe("changesPrintVersion", () => {
  it("is false when nothing changed", () => {
    expect(changesPrintVersion(stored(), unchanged(), false)).toBe(false);
  });

  it("is false when only the configuration name or an area name changed", () => {
    const body = unchanged();
    expect(
      changesPrintVersion(
        stored(),
        {
          ...body,
          name: "Another name",
          printAreas: [{ ...firstArea(body), name: "Another area name" }],
        },
        false,
      ),
    ).toBe(false);
  });

  it.each<[string, (body: PrintConfigBody) => PrintConfigBody]>([
    ["safe margin", (b) => ({ ...b, printAreas: [{ ...firstArea(b), safeMarginMm: 4 }] })],
    ["bleed", (b) => ({ ...b, printAreas: [{ ...firstArea(b), bleedMm: 3 }] })],
    ["minimum dpi", (b) => ({ ...b, minDpi: 450 })],
    ["colour mode", (b) => ({ ...b, colorMode: "RGB" })],
    ["file formats", (b) => ({ ...b, allowedFileFormats: ["image/png"] })],
    ["maximum file size", (b) => ({ ...b, maxFileSizeMb: 20 })],
    ["maximum colours", (b) => ({ ...b, maxColors: 6 })],
    ["fonts: every font to a list", (b) => ({ ...b, allowedFontCodes: ["lobster"] })],
    ["a model figure", (b) => ({ ...b, model: { ...CUP, seamMm: 6 } })],
    [
      "the mesh map",
      (b) => ({ ...b, surfaces: [{ printAreaCode: "BODY", meshName: "print:OTHER" }] }),
    ],
  ])("is true when the %s changed", (_name, change) => {
    expect(changesPrintVersion(stored(), change(unchanged()), false)).toBe(true);
  });

  it("is false when the same fonts or formats come in another order", () => {
    const base = stored({
      allowedFontCodes: ["lobster", "oswald"],
      allowedFileFormats: ["image/png", "image/jpeg"],
    });
    const body = {
      ...unchanged(base),
      allowedFontCodes: ["oswald", "lobster"],
      allowedFileFormats: ["image/jpeg", "image/png"],
    };
    expect(changesPrintVersion(base, body, false)).toBe(false);
  });

  it("is true when a new model file is sent, whatever else", () => {
    expect(changesPrintVersion(stored(), unchanged(), true)).toBe(true);
  });
});
