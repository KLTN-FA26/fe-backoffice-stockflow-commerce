import { describe, expect, it } from "vitest";

import { printConfigSaveInputSchema } from "../schemas";
import { BAG_BODY, CUP, cupDto, model3dWithFile } from "../test-fixtures";
import { savedFile } from "./print-config-test-utils";
import { defaultsFor } from "./print-defaults";
import { buildSaveInput, templateOfSource } from "./save-input";

import type { BagModel, PrintAreaCode } from "../model3d";

const BODY_MESH = [{ printAreaCode: "BODY" as PrintAreaCode, meshName: "print:BODY" }];
const FACES = (["FRONT", "BACK", "LEFT", "RIGHT"] as const).map((code) => ({
  printAreaCode: code,
  meshName: `print:${code}`,
}));
const bagModel = BAG_BODY.model;

const stored = cupDto({ model3d: model3dWithFile() });

describe("buildSaveInput", () => {
  it("a measured cup and the defaults give the configuration, its area table and the file", () => {
    const file = savedFile("cup.glb");
    const input = buildSaveInput({
      source: { model: CUP, printMeshes: BODY_MESH },
      stored: null,
      defaults: defaultsFor("parametric-cup", null),
      file,
    });
    expect(input).not.toBeNull();
    expect(input?.config.model).toEqual(CUP);
    expect(input?.config.printAreas).toEqual([
      { code: "BODY", name: "Thân ly", safeMarginMm: 3, bleedMm: 2 },
    ]);
    expect(input?.config.surfaces).toEqual([{ printAreaCode: "BODY", meshName: "print:BODY" }]);
    expect(input?.config).toMatchObject({ code: "CUP-BODY", minDpi: 300, colorMode: "CMYK" });
    expect(input?.file).toEqual(file);
    expect(input?.stored).toBeNull();
    expect(printConfigSaveInputSchema.safeParse(input).success).toBe(true);
  });

  it("the defaults the person edited reach the model and the areas, and the measured figures do not move", () => {
    const input = buildSaveInput({
      source: { model: CUP, printMeshes: BODY_MESH },
      stored: null,
      defaults: {
        ...defaultsFor("parametric-cup", null),
        seamMm: 6,
        rimMm: 2,
        cupMaterial: "kraft",
        safeMarginMm: 4,
        bleedMm: 1,
      },
      file: savedFile(),
    });
    expect(input?.config.model).toEqual({ ...CUP, seamMm: 6, rimMm: 2, material: "kraft" });
    expect(input?.config.printAreas[0]).toMatchObject({ safeMarginMm: 4, bleedMm: 1 });
  });

  it("a four-face bag gives its four areas with the bag defaults and passes the save schema", () => {
    const input = buildSaveInput({
      source: { model: bagModel, printMeshes: FACES },
      stored: null,
      defaults: defaultsFor("parametric-bag", null),
      file: savedFile(),
    });
    expect(input?.config.printAreas).toEqual([
      { code: "FRONT", name: "Mặt trước", safeMarginMm: 5, bleedMm: 3 },
      { code: "BACK", name: "Mặt sau", safeMarginMm: 5, bleedMm: 3 },
      { code: "LEFT", name: "Hông trái", safeMarginMm: 5, bleedMm: 3 },
      { code: "RIGHT", name: "Hông phải", safeMarginMm: 5, bleedMm: 3 },
    ]);
    expect(input?.config.surfaces.map((s) => s.meshName)).toEqual(FACES.map((f) => f.meshName));
    // No limit until the printer states one (a guessed 4 reached every storefront picture as a hint).
    expect(input?.config).toMatchObject({ code: "BAG-FACES", maxColors: null });
    expect(printConfigSaveInputSchema.safeParse(input).success).toBe(true);
  });

  it("a new bag sends the pre-filled glue flap and bottom fold, and the ones typed", () => {
    const prefilled = buildSaveInput({
      source: { model: bagModel, printMeshes: FACES },
      stored: null,
      defaults: defaultsFor("parametric-bag", null, bagModel),
      file: savedFile(),
    });
    // BAG_BODY's gusset is 110: round2(0.6 × 110) = 66
    expect(prefilled?.config.model).toMatchObject({ glueFlapMm: 20, bottomFoldMm: 66 });
    const typed = buildSaveInput({
      source: { model: bagModel, printMeshes: FACES },
      stored: null,
      defaults: {
        ...defaultsFor("parametric-bag", null, bagModel),
        glueFlapMm: 15,
        bottomFoldMm: 40,
      },
      file: savedFile(),
    });
    expect(typed?.config.model).toMatchObject({ glueFlapMm: 15, bottomFoldMm: 40 });
    expect(printConfigSaveInputSchema.safeParse(typed).success).toBe(true);
  });

  it("a bag with a top fold keeps it in the model", () => {
    const input = buildSaveInput({
      source: { model: bagModel, printMeshes: FACES },
      stored: null,
      defaults: { ...defaultsFor("parametric-bag", null), topFoldMm: 30, handle: "flat" },
      file: savedFile(),
    });
    expect(input?.config.model).toMatchObject({ topFoldMm: 30, handle: "flat" });
  });

  it("with no new file it re-sends the stored model and sends no checksum, changing only the defaults", () => {
    const input = buildSaveInput({
      source: null,
      stored,
      defaults: { ...defaultsFor("parametric-cup", stored), seamMm: 6 },
    });
    expect(input?.file).toBeUndefined();
    expect(input).not.toHaveProperty("modelFileChecksum");
    expect(input?.stored).toMatchObject({ hasFile: true });
    expect(input?.config.model).toEqual({ ...CUP, seamMm: 6 });
    expect(input?.config.code).toBe(stored.code);
    expect(input?.stored).toMatchObject({ templateId: "tpl-1", version: 3 });
    expect(input?.config.surfaces).toEqual(stored.model3d?.surfaces);
    expect(printConfigSaveInputSchema.safeParse(input).success).toBe(true);
  });

  it("with a new file on a stored configuration it keeps the stored code and the form's file rules", () => {
    const withRules = { ...stored, minDpi: 600, maxColors: 2 };
    const input = buildSaveInput({
      source: { model: CUP, printMeshes: BODY_MESH },
      stored: withRules,
      defaults: defaultsFor("parametric-cup", withRules),
      file: savedFile(),
    });
    expect(input?.config).toMatchObject({ code: "CUP12-BODY", minDpi: 600, maxColors: 2 });
    expect(input).not.toHaveProperty("modelFileChecksum");
  });

  it("save sends the file rules just edited, not the stored ones", () => {
    const edited = {
      ...defaultsFor("parametric-cup", { ...stored, minDpi: 600, maxColors: 2 }),
      minDpi: 450,
      colorMode: "RGB" as const,
      allowedFileFormats: ["image/webp" as const],
      maxFileSizeMb: 20,
      maxColors: 6,
      allowedFontCodes: ["lobster", "oswald"],
    };
    const input = buildSaveInput({
      source: null,
      stored: { ...stored, minDpi: 600, maxColors: 2 },
      defaults: edited,
    });
    expect(input?.config).toMatchObject({
      minDpi: 450,
      colorMode: "RGB",
      allowedFileFormats: ["image/webp"],
      maxFileSizeMb: 20,
      maxColors: 6,
      allowedFontCodes: ["lobster", "oswald"],
    });
    expect(printConfigSaveInputSchema.safeParse(input).success).toBe(true);
  });

  it("maxColors null and a null font list are sent as no limit", () => {
    const input = buildSaveInput({
      source: null,
      stored: { ...stored, maxColors: 2, allowedFontCodes: ["lobster"] },
      defaults: {
        ...defaultsFor("parametric-cup", stored),
        maxColors: null,
        allowedFontCodes: null,
      },
    });
    expect(input?.config).toMatchObject({ maxColors: null, allowedFontCodes: null });
  });

  it("gives nothing to save without a measurement and without a stored model", () => {
    const empty = defaultsFor("parametric-cup", null);
    expect(buildSaveInput({ source: null, stored: null, defaults: empty })).toBeNull();
    expect(
      buildSaveInput({ source: null, stored: cupDto({ model: null }), defaults: empty }),
    ).toBeNull();
  });

  it("a configuration written before files were required takes free edits: its values go back as they were read", () => {
    const legacy = cupDto({
      model: { ...CUP, topDiameterMm: 90.123456 },
      model3d: { hasFile: false, fileName: null, fileChecksum: null, surfaces: [] },
    });
    const input = buildSaveInput({
      source: null,
      stored: legacy,
      defaults: { ...defaultsFor("parametric-cup", legacy), rimMm: 4 },
    });
    expect(input?.config.model).toEqual({ ...CUP, topDiameterMm: 90.123456, rimMm: 4 });
    expect(input?.config.surfaces).toEqual([]);
    expect(input?.stored).toMatchObject({ hasFile: false, surfaces: [] });
    expect(printConfigSaveInputSchema.safeParse(input).success).toBe(true);
  });
});

const BAG_MODEL: BagModel = {
  kind: "parametric-bag",
  handle: "twisted",
  material: "kraft-brown",
  widthMm: 260,
  gussetMm: 120,
  heightMm: 280,
  topFoldMm: 0,
};
const bagStored = (areas: { safe: number; bleed: number }[]) =>
  cupDto({
    code: "BAG-X",
    name: "Túi X",
    model: { ...BAG_MODEL, heightMm: 320, topFoldMm: 40 },
    printAreas: FACES.map((f, i) => ({
      ...cupDto().printAreas[0],
      code: f.printAreaCode,
      name: f.printAreaCode,
      safeMarginMm: areas[i]?.safe ?? 5,
      bleedMm: areas[i]?.bleed ?? 3,
    })),
    model3d: { ...model3dWithFile(), surfaces: FACES },
  });

describe("buildSaveInput: a template written before files were required, saving a free field", () => {
  const noFile = (surfaces: { printAreaCode: PrintAreaCode; meshName: string }[]) => ({
    hasFile: false,
    fileName: null,
    fileChecksum: null,
    surfaces,
  });
  const freeEdit = (stored: ReturnType<typeof cupDto>, kind: "parametric-bag" | "parametric-cup") =>
    buildSaveInput({
      source: null,
      stored,
      defaults: {
        ...defaultsFor(kind, stored),
        ...(kind === "parametric-bag" ? { handle: "flat" as const } : { rimMm: 4 }),
      },
    });

  it.each([
    ["an empty table", []],
    ["a partial table", FACES.slice(0, 2)],
  ])(
    "a bag with %s keeps its four areas and its table as stored, and passes the BE's rules",
    (_name, table) => {
      const stored = cupDto({ ...bagStored([]), model3d: noFile(table) });
      let input: ReturnType<typeof buildSaveInput> = null;
      expect(() => (input = freeEdit(stored, "parametric-bag"))).not.toThrow();
      expect(input).not.toBeNull();
      const checked = printConfigSaveInputSchema.safeParse(input);
      expect(checked.success).toBe(true);
      if (!checked.success) return;
      expect(checked.data.config.printAreas.map((a) => a.code)).toEqual([
        "FRONT",
        "BACK",
        "LEFT",
        "RIGHT",
      ]);
      expect(checked.data.config.surfaces).toEqual(table);
      expect(checked.data.config.model).toMatchObject({
        handle: "flat",
        heightMm: 320,
        topFoldMm: 40,
      });
    },
  );

  it("a cup with an empty table saves a free field the same way", () => {
    const stored = cupDto({ model3d: noFile([]) });
    const checked = printConfigSaveInputSchema.safeParse(freeEdit(stored, "parametric-cup"));
    expect(checked.success).toBe(true);
    if (!checked.success) return;
    expect(checked.data.config.printAreas.map((a) => a.code)).toEqual(["BODY"]);
    expect(checked.data.config.surfaces).toEqual([]);
    expect(checked.data.config.model).toMatchObject({ rimMm: 4, topDiameterMm: 90 });
  });

  it("a bag whose stored template has no print area at all gives nothing to save instead of throwing", () => {
    const stored = cupDto({ ...bagStored([]), printAreas: [], model3d: noFile([]) });
    expect(freeEdit(stored, "parametric-bag")).toBeNull();
  });
});

describe("buildSaveInput: bag top fold, kind change, per-area margins", () => {
  it("the top fold is added on the measured face height: the print area keeps the file's 280 mm", () => {
    const defaults = { ...defaultsFor("parametric-bag", null), topFoldMm: 40 };
    const source = { model: BAG_MODEL, printMeshes: FACES };
    const derived = templateOfSource({ source, stored: null, defaults });
    expect(derived?.template.printAreas.map((a) => a.heightMm)).toEqual([280, 280, 280, 280]);
    expect(derived?.model).toMatchObject({ heightMm: 320, topFoldMm: 40 });
    const input = buildSaveInput({ source, stored: null, defaults, file: savedFile() });
    expect(input?.config.model).toMatchObject({ heightMm: 320, topFoldMm: 40 });
  });

  it("a stored bag changing only its fold keeps the face height", () => {
    const stored = bagStored([]);
    const input = buildSaveInput({
      source: null,
      stored,
      defaults: { ...defaultsFor("parametric-bag", stored), topFoldMm: 20 },
    });
    expect(input?.config.model).toMatchObject({ heightMm: 300, topFoldMm: 20 });
    expect(printConfigSaveInputSchema.safeParse(input).success).toBe(true);
  });

  it("a stored bag whose fold does not change sends its height exactly as read, whatever its decimals", () => {
    const odd = cupDto({
      ...bagStored([]),
      model: { ...BAG_MODEL, heightMm: 320.1234567, topFoldMm: 40.3 },
    });
    const input = buildSaveInput({
      source: null,
      stored: odd,
      defaults: { ...defaultsFor("parametric-bag", odd), handle: "flat" },
    });
    expect(input?.config.model).toMatchObject({ heightMm: 320.1234567, topFoldMm: 40.3 });
  });

  it("a bag file replacing a cup configuration gets the bag's code and name", () => {
    const input = buildSaveInput({
      source: { model: BAG_MODEL, printMeshes: FACES },
      stored: { ...stored, name: "Ly giấy 12oz - thân ly" },
      defaults: defaultsFor("parametric-bag", null),
      file: savedFile(),
    });
    expect(input?.config).toMatchObject({ code: "BAG-FACES", name: "Bốn mặt túi" });
  });

  it("faces with their own margins keep them unless the person types a new value", () => {
    const stored = bagStored([
      { safe: 5, bleed: 3 },
      { safe: 5, bleed: 3 },
      { safe: 6, bleed: 4 },
      { safe: 6, bleed: 4 },
    ]);
    const base = defaultsFor("parametric-bag", stored);
    const kept = buildSaveInput({ source: null, stored, defaults: { ...base, handle: "flat" } });
    expect(kept?.config.printAreas.map((a) => [a.safeMarginMm, a.bleedMm])).toEqual([
      [5, 3],
      [5, 3],
      [6, 4],
      [6, 4],
    ]);
    const changed = buildSaveInput({
      source: null,
      stored,
      defaults: { ...base, safeMarginMm: 7 },
    });
    expect(changed?.config.printAreas.map((a) => [a.safeMarginMm, a.bleedMm])).toEqual([
      [7, 3],
      [7, 3],
      [7, 4],
      [7, 4],
    ]);
  });
});

describe("defaultsFor", () => {
  it("starts from the constants, per kind", () => {
    expect(defaultsFor("parametric-cup", null)).toMatchObject({
      safeMarginMm: 3,
      bleedMm: 2,
      seamMm: 8,
      rimMm: 3,
    });
    expect(defaultsFor("parametric-bag", null)).toMatchObject({
      safeMarginMm: 5,
      bleedMm: 3,
      topFoldMm: 0,
    });
  });

  it("reads the stored configuration when it is of the same kind, the constants when it is not", () => {
    const same = cupDto({ model: { ...CUP, seamMm: 5 } });
    expect(defaultsFor("parametric-cup", same)).toMatchObject({
      seamMm: 5,
      safeMarginMm: 3,
      bleedMm: 2,
    });
    expect(defaultsFor("parametric-bag", same)).toMatchObject({ safeMarginMm: 5, bleedMm: 3 });
  });
});
