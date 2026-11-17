import { describe, expect, it } from "vitest";

import {
  downloadLinkSchema,
  printConfigBodySchema,
  printConfigDtoSchema,
  printConfigSaveInputSchema,
} from "./schemas";
import {
  BAG_BODY,
  CUP,
  CUP_BODY,
  cupWire,
  glbBytes,
  model3dWithFile,
  SHA_A,
  storedWith,
} from "./test-fixtures";

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("PrintConfigDto", () => {
  it("a template without a file: model3d is there with hasFile false and the omitted fields read as null", () => {
    // `cupWire` is what the BE sends (nulls omitted): no fileName, no fileChecksum, no maxColors, no reference file.
    expect(printConfigDtoSchema.parse(cupWire)).toMatchObject({
      model3d: { hasFile: false, fileName: null, fileChecksum: null, surfaces: [] },
      maxColors: null,
      allowedFontCodes: null,
      referenceFileName: null,
    });
  });

  it("a template with a file: name, checksum and surfaces, and no url", () => {
    const dto = printConfigDtoSchema.parse({ ...cupWire, model3d: model3dWithFile(SHA_A) });
    expect(dto.model3d).toEqual({
      hasFile: true,
      fileName: "cup.glb",
      fileChecksum: SHA_A,
      surfaces: [{ printAreaCode: "BODY", meshName: "print:BODY" }],
    });
    expect("modelFileChecksum" in dto).toBe(false);
  });

  it("takes explicit nulls as well as absent fields (the BE omits them, a proxy may not)", () => {
    const dto = printConfigDtoSchema.parse({
      ...cupWire,
      maxColors: null,
      referenceFileName: null,
      model3d: { hasFile: false, fileName: null, fileChecksum: null, surfaces: [] },
    });
    expect(dto.model3d.fileChecksum).toBeNull();
  });

  it("model3d is required: a response without it is a contract bug, not a template without a file", () => {
    const { model3d: _model3d, ...withoutModel3d } = cupWire;
    expect(printConfigDtoSchema.safeParse(withoutModel3d).success).toBe(false);
  });

  it("takes a template written before models existed (model absent)", () => {
    const { model: _model, ...legacy } = cupWire;
    expect(printConfigDtoSchema.parse(legacy).model).toBeNull();
  });

  it("refuses a checksum that is not SHA-256 hex", () => {
    const bad = printConfigDtoSchema.safeParse({
      ...cupWire,
      model3d: { ...model3dWithFile(), fileChecksum: "xyz" },
    });
    expect(bad.success).toBe(false);
  });
});

describe("the download link", () => {
  it("is a url with an expiry; the expiry may be absent", () => {
    expect(
      downloadLinkSchema.parse({ url: "https://x/y.glb", expiresAt: "2026-11-15T10:00:00Z" }),
    ).toEqual({
      url: "https://x/y.glb",
      expiresAt: "2026-11-15T10:00:00Z",
    });
    expect(downloadLinkSchema.parse({ url: "https://x/y.glb" }).expiresAt).toBeNull();
    expect(downloadLinkSchema.safeParse({ url: "" }).success).toBe(false);
  });
});

describe("PrintConfigBody rules", () => {
  it("accepts the sample cup and a four-face bag", () => {
    expect(printConfigBodySchema.safeParse(CUP_BODY).success).toBe(true);
    expect(printConfigBodySchema.safeParse(BAG_BODY).success).toBe(true);
  });

  it("no print area twice in the table (BE PrintAreaDuplicate)", () => {
    const [first] = CUP_BODY.surfaces;
    const result = printConfigBodySchema.safeParse({ ...CUP_BODY, surfaces: [first, first] });
    expect(messages(result)).toContain("Vùng in BODY xuất hiện hai lần trong bảng ghép.");
  });

  it("a surface names an area the template has (BE PrintAreaUnknown)", () => {
    const result = printConfigBodySchema.safeParse({
      ...CUP_BODY,
      surfaces: [...CUP_BODY.surfaces, { printAreaCode: "FRONT", meshName: "print:FRONT" }],
    });
    expect(messages(result)).toContain("Bảng ghép nêu vùng in FRONT mà mẫu không có.");
  });

  it("a table without a file may be incomplete or named otherwise: that is the save's rule, with a file", () => {
    expect(printConfigBodySchema.safeParse({ ...CUP_BODY, surfaces: [] }).success).toBe(true);
    const misnamed = [{ printAreaCode: "BODY" as const, meshName: "Cylinder.001" }];
    expect(printConfigBodySchema.safeParse({ ...CUP_BODY, surfaces: misnamed }).success).toBe(true);
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

describe("PrintConfigSaveInput rules (the BE's, checked before sending)", () => {
  const taller = { ...CUP_BODY, model: { ...CUP, heightMm: 120 } };
  const MODEL_FILE_REQUIRED = "Số đo này lấy từ file 3D, hãy tải file mới cùng số đo.";
  const parse = (input: object) => printConfigSaveInputSchema.safeParse(input);

  it("a create needs its file (BE 409 PRINT_CONFIG_MODEL_FILE_REQUIRED)", () => {
    const refused = parse({ config: CUP_BODY, stored: null });
    expect(refused.error?.issues[0]?.path).toEqual(["file"]);
    expect(messages(refused)).toEqual([
      "Cấu hình in mới phải tạo cùng file 3D (.glb): hãy chọn file rồi lưu.",
    ]);
    expect(parse({ config: CUP_BODY, stored: null, file: glbBytes() }).success).toBe(true);
  });

  it("without a new file a measured figure may not change, with or without a stored file", () => {
    for (const stored of [storedWith(true), storedWith(false)]) {
      const refused = parse({ config: taller, stored });
      expect(refused.error?.issues[0]?.path).toEqual(["file"]);
      expect(messages(refused)).toEqual([MODEL_FILE_REQUIRED]);
    }
    expect(parse({ config: taller, stored: storedWith(true), file: glbBytes() }).success).toBe(
      true,
    );
  });

  it.each([
    ["topDiameterMm", 90.01],
    ["bottomDiameterMm", 59.99],
    ["heightMm", 110.01],
    ["bandTopOffsetMm", 7],
    ["bandBottomOffsetMm", 8.5],
  ])("a cup's %s is the file's", (key, value) => {
    const config = { ...CUP_BODY, model: { ...CUP, [key]: value } };
    expect(messages(parse({ config, stored: storedWith(true) }))).toEqual([MODEL_FILE_REQUIRED]);
  });

  it("compared as the BE compares, in hundredths of a millimetre", () => {
    const within = { ...CUP_BODY, model: { ...CUP, heightMm: 110.004 } };
    expect(parse({ config: within, stored: storedWith(true) }).success).toBe(true);
  });

  it("the kind, a bag's width, gusset and printed height are the file's; its fold may move with its height", () => {
    const bag = BAG_BODY.model;
    if (bag.kind !== "parametric-bag") throw new Error("bag fixture");
    const stored = { ...storedWith(true), model: bag, surfaces: BAG_BODY.surfaces };
    const save = (model: object) =>
      parse({ config: { ...BAG_BODY, model: { ...bag, ...model } }, stored });
    expect(save({ widthMm: 241 }).success).toBe(false);
    expect(save({ gussetMm: 100 }).success).toBe(false);
    expect(save({ heightMm: 320 }).success).toBe(false);
    expect(save({ topFoldMm: 40 }).success).toBe(false);
    expect(save({ heightMm: 320, topFoldMm: 40 }).success).toBe(true);
    expect(save({ handle: "flat", material: "kraft-white" }).success).toBe(true);
    // another kind
    expect(messages(parse({ config: BAG_BODY, stored: storedWith(true) }))).toContain(
      MODEL_FILE_REQUIRED,
    );
  });

  it("a template without a model takes no save without a file: any model is a change of kind", () => {
    const stored = { ...storedWith(false), model: null };
    expect(messages(parse({ config: CUP_BODY, stored }))).toEqual([MODEL_FILE_REQUIRED]);
  });

  it("the area ↔ mesh table may not change without a new file", () => {
    const renamed = {
      ...CUP_BODY,
      surfaces: [{ printAreaCode: "BODY" as const, meshName: "print:BODY-2" }],
    };
    expect(messages(parse({ config: renamed, stored: storedWith(false) }))).toEqual([
      MODEL_FILE_REQUIRED,
    ]);
    // the same rows in another order are the same table (the BE compares them as a set)
    const stored = {
      ...storedWith(true),
      model: BAG_BODY.model,
      surfaces: [...BAG_BODY.surfaces].reverse(),
    };
    expect(parse({ config: BAG_BODY, stored }).success).toBe(true);
  });

  it("free fields pass without a file", () => {
    const free = {
      ...CUP_BODY,
      name: "Khác",
      model: { ...CUP, seamMm: 9, material: "kraft" as const },
    };
    expect(parse({ config: free, stored: storedWith(true) }).success).toBe(true);
    expect(parse({ config: free, stored: storedWith(false) }).success).toBe(true);
  });

  it("with a file sent, every area has its print:<code> mesh: each fault names the area (BE 422)", () => {
    const misnamed = parse({
      config: {
        ...BAG_BODY,
        surfaces: BAG_BODY.surfaces.map((s) =>
          s.printAreaCode === "BACK" ? { ...s, meshName: "print:FRONT" } : s,
        ),
      },
      stored: null,
      file: glbBytes(),
    });
    expect(messages(misnamed)).toContain("Mesh của vùng in BACK phải tên là print:BACK.");
    const missing = parse({
      config: { ...BAG_BODY, surfaces: BAG_BODY.surfaces.slice(0, 3) },
      stored: null,
      file: glbBytes(),
    });
    expect(messages(missing)).toEqual(["Vùng in RIGHT chưa có mesh print:RIGHT trong file."]);
  });

  it("with a stored file and no new file, the stored table is checked the same (a broken one blocks every save)", () => {
    const broken = [{ printAreaCode: "BODY" as const, meshName: "Body" }];
    const stored = { ...storedWith(true), surfaces: broken };
    expect(messages(parse({ config: { ...CUP_BODY, surfaces: broken }, stored }))).toEqual([
      "Mesh của vùng in BODY phải tên là print:BODY.",
    ]);
    // without a stored file the BE does not ask for a complete table
    const legacy = { ...storedWith(false), surfaces: [] };
    expect(parse({ config: { ...CUP_BODY, surfaces: [] }, stored: legacy }).success).toBe(true);
  });

  it("the BE takes no checksum, so none lets a change through: only a new file does", () => {
    const sneaky = parse({ config: taller, stored: storedWith(true), modelFileChecksum: SHA_A });
    expect(sneaky.success).toBe(false);
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
