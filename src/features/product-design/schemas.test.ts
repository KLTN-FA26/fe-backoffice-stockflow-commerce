import { describe, expect, it } from "vitest";

import { printConfigBodySchema, printConfigDtoSchema, printConfigSaveInputSchema } from "./schemas";
import {
  BAG_BODY,
  CUP,
  CUP_BODY,
  cupWire,
  glbBytes,
  SHA_A,
  SHA_B,
  storedWith,
} from "./test-fixtures";

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("PrintConfigDto", () => {
  it("normalises what the BE omits to null (no model3d, no checksum, no reference file)", () => {
    expect(printConfigDtoSchema.parse(cupWire)).toMatchObject({
      model3d: null,
      modelFileChecksum: null,
      maxColors: null,
      allowedFontCodes: null,
      referenceFileName: null,
    });
  });

  it("reads model3d with its surfaces and the checksum", () => {
    const dto = printConfigDtoSchema.parse({
      ...cupWire,
      model3d: {
        url: "https://x/y.glb",
        surfaces: [{ printAreaCode: "BODY", meshName: "print:BODY" }],
      },
      modelFileChecksum: SHA_A,
    });
    expect(dto.model3d?.surfaces).toHaveLength(1);
    expect(dto.modelFileChecksum).toBe(SHA_A);
  });

  it("takes a template written before models existed (model absent)", () => {
    const { model: _model, ...legacy } = cupWire;
    expect(printConfigDtoSchema.parse(legacy).model).toBeNull();
  });

  it("refuses a checksum that is not SHA-256 hex", () => {
    const bad = printConfigDtoSchema.safeParse({ ...cupWire, modelFileChecksum: "xyz" });
    expect(bad.success).toBe(false);
  });
});

describe("PrintConfigBody rules", () => {
  it("accepts the sample cup and a four-face bag", () => {
    expect(printConfigBodySchema.safeParse(CUP_BODY).success).toBe(true);
    expect(printConfigBodySchema.safeParse(BAG_BODY).success).toBe(true);
  });

  it("meshName is exactly print: + the area code", () => {
    const result = printConfigBodySchema.safeParse({
      ...CUP_BODY,
      surfaces: [{ printAreaCode: "BODY", meshName: "Cylinder.001" }],
    });
    expect(messages(result)).toContain("Mesh của vùng in BODY phải tên là print:BODY.");
    const other = printConfigBodySchema.safeParse({
      ...BAG_BODY,
      surfaces: BAG_BODY.surfaces.map((s) =>
        s.printAreaCode === "BACK" ? { ...s, meshName: "print:FRONT" } : s,
      ),
    });
    expect(messages(other)).toContain("Mesh của vùng in BACK phải tên là print:BACK.");
  });

  it("every print area has a surface entry", () => {
    const result = printConfigBodySchema.safeParse({
      ...BAG_BODY,
      surfaces: BAG_BODY.surfaces.slice(0, 3),
    });
    expect(messages(result)).toEqual(["Vùng in RIGHT chưa có mesh trong bảng ghép."]);
  });

  it("no print area twice in the table", () => {
    const [first] = CUP_BODY.surfaces;
    const result = printConfigBodySchema.safeParse({ ...CUP_BODY, surfaces: [first, first] });
    expect(messages(result)).toContain("Vùng in BODY xuất hiện hai lần trong bảng ghép.");
  });

  it("a surface names an area the template has", () => {
    const result = printConfigBodySchema.safeParse({
      ...CUP_BODY,
      surfaces: [...CUP_BODY.surfaces, { printAreaCode: "FRONT", meshName: "print:FRONT" }],
    });
    expect(messages(result)).toContain("Bảng ghép nêu vùng in FRONT mà mẫu không có.");
  });

  it("a cup has only BODY, a bag exactly the four faces, none twice", () => {
    const cup = printConfigBodySchema.safeParse({
      ...CUP_BODY,
      printAreas: [
        ...CUP_BODY.printAreas,
        { code: "FRONT", name: "F", safeMarginMm: 3, bleedMm: 2 },
      ],
    });
    expect(messages(cup)).toContain("Ly chỉ có một vùng in là BODY.");
    const bag = printConfigBodySchema.safeParse({
      ...BAG_BODY,
      printAreas: BAG_BODY.printAreas.slice(0, 3),
    });
    expect(messages(bag)).toContain("Túi có bốn vùng in: FRONT, BACK, LEFT, RIGHT.");
    const twice = printConfigBodySchema.safeParse({
      ...BAG_BODY,
      printAreas: [...BAG_BODY.printAreas.slice(0, 3), BAG_BODY.printAreas[0]],
    });
    expect(messages(twice)).toContain("Vùng in FRONT khai báo hai lần.");
  });
});

describe("PrintConfigSaveInput rules", () => {
  const taller = { ...CUP_BODY, model: { ...CUP, heightMm: 120 } };

  it("B-6: changed measured figure with a stored file needs a file or the stored checksum", () => {
    const refused = printConfigSaveInputSchema.safeParse({
      config: taller,
      stored: storedWith(SHA_A),
    });
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0]?.path).toEqual(["file"]);
  });

  it("B-6: a checksum that is not the stored file's does not pass either", () => {
    const wrong = printConfigSaveInputSchema.safeParse({
      config: taller,
      stored: storedWith(SHA_A),
      modelFileChecksum: SHA_B,
    });
    expect(wrong.success).toBe(false);
  });

  it("B-6: a new file, or the stored file's checksum, lets the change through", () => {
    const withFile = printConfigSaveInputSchema.safeParse({
      config: taller,
      stored: storedWith(SHA_A),
      file: glbBytes(),
    });
    const withChecksum = printConfigSaveInputSchema.safeParse({
      config: taller,
      stored: storedWith(SHA_A),
      modelFileChecksum: SHA_A,
    });
    expect(withFile.success).toBe(true);
    expect(withChecksum.success).toBe(true);
  });

  it("B-6 does not apply to unchanged figures, to free fields, or with no stored file", () => {
    const free = { ...CUP_BODY, model: { ...CUP, seamMm: 9, material: "kraft" as const } };
    const input = (config: typeof CUP_BODY, stored: ReturnType<typeof storedWith> | null) =>
      printConfigSaveInputSchema.safeParse({ config, stored }).success;
    expect(input(free, storedWith(SHA_A))).toBe(true);
    expect(input(taller, storedWith(null))).toBe(true);
    expect(input(taller, null)).toBe(true);
  });

  it("changing a band offset or the kind counts as a changed figure", () => {
    const band = { ...CUP_BODY, model: { ...CUP, bandTopOffsetMm: 7 } };
    const input = (config: typeof CUP_BODY) =>
      printConfigSaveInputSchema.safeParse({ config, stored: storedWith(SHA_A) }).success;
    expect(input(band)).toBe(false);
    expect(input(BAG_BODY)).toBe(false);
  });

  it("the file is a non-empty .glb of at most 10 MB", () => {
    const check = (file: { name: string; bytes: ArrayBuffer }) =>
      messages(printConfigSaveInputSchema.safeParse({ config: CUP_BODY, stored: null, file }));
    expect(check(glbBytes("cup.obj"))).toContain("File model phải là .glb.");
    expect(check(glbBytes("cup.glb", 0))).toContain("File model đang rỗng.");
    expect(check(glbBytes("cup.glb", 10 * 1024 * 1024 + 1))).toContain("File model tối đa 10 MB.");
    expect(check(glbBytes("CUP.GLB"))).toEqual([]);
  });

  it("the file is the measured bytes, not a File that a browser may read again", () => {
    const file = new File([new Uint8Array(4)], "cup.glb");
    const result = printConfigSaveInputSchema.safeParse({ config: CUP_BODY, stored: null, file });
    expect(result.success).toBe(false);
  });
});
