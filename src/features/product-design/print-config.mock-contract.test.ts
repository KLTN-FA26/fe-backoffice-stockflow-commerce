/**
 * Contract test: the mock adapter speaks the BE contract of customization templates
 * (`CustomizationTemplateController` / `PrintConfigService` / `ModelFileRules`, origin/develop d47ed4ae), so that
 * `api.ts` (zod at the boundary) runs the same on the mock and on the real BE: a template and its `.glb` saved in ONE
 * multipart request, the JSON `PUT` for edits without a file, `PUT …/model-file` gone (404), the file-required and
 * measured-value rules, the area ↔ mesh rules, activation needing a file and a full table, the envelope.
 */
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { EICAR_PREFIX } from "@/lib/api/mock-print-config-file";
import { sha256Hex } from "@/lib/crypto/sha256";

import { getModelFileLink, getPrintConfig, savePrintConfig } from "./api";
import { customizationTemplateSchema } from "./model3d";
import {
  apiError,
  captureRequests,
  EMPTY,
  MULTIPART,
  multipart,
  plantTemplate,
  SEED,
  seeded,
  STANDARD,
  setUpMockBackend,
} from "./mock-backend-test-utils";
import { storedOf } from "./selectors";
import { BAG_BODY, CUP, CUP_BODY, glbBytes } from "./test-fixtures";

import type { AxiosRequestConfig } from "axios";

setUpMockBackend();

const SEED_SHA = "1faf14f6b7b9e7be5ac2d174dce76d7574ef5299387c001bdd0703943f65a7ea";
const SAMPLE_URL = "/mock/models/sample-cup-12oz.glb";
const base = (p: string, v: string) => `/products/${p}/variants/${v}/customization-templates`;
const seedPath = () => `${base(SEED.productId, SEED.variantId)}/tpl-seed-cup12-body`;
const legacyPath = () => `${base(EMPTY.productId, EMPTY.variantId)}/tpl-legacy`;
const BODY_ROW = [{ printAreaCode: "BODY", meshName: "print:BODY" }];

/** A raw template, as the BE's `CustomizationTemplateRequest` takes it (the seed's values). */
const rawBody = (extra: Record<string, unknown> = {}) => ({
  name: CUP_BODY.name,
  minDpi: 300,
  colorMode: "CMYK",
  allowedFileFormats: ["image/png"],
  maxFileSizeMb: 50,
  model: CUP,
  printAreas: CUP_BODY.printAreas,
  model3d: { surfaces: BODY_ROW },
  ...extra,
});
const rawBag = (extra: Record<string, unknown> = {}) =>
  rawBody({
    model: BAG_BODY.model,
    printAreas: BAG_BODY.printAreas,
    model3d: { surfaces: BAG_BODY.surfaces },
    ...extra,
  });
const post = (form: FormData | object, p = base(EMPTY.productId, EMPTY.variantId)) =>
  form instanceof FormData ? api.post<unknown>(p, form, MULTIPART) : api.post<unknown>(p, form);
const put = (path: string, form: FormData | object) =>
  form instanceof FormData ? api.put<unknown>(path, form, MULTIPART) : api.put<unknown>(path, form);
/** The same body with no `model3d`: the BE keeps the stored table. */
const withoutTable = (body: Record<string, unknown>) => {
  const copy = { ...body };
  delete copy.model3d;
  return copy;
};
const versionOf = async () => (await seeded()).version;

describe("GET customization-templates", () => {
  it("the seeded variant has a configuration with the sample cup file and its measured figures", async () => {
    const config = await seeded();
    expect(config).toMatchObject({
      active: true,
      model3d: {
        hasFile: true,
        fileName: "sample-cup-12oz.glb",
        fileChecksum: SEED_SHA,
        surfaces: BODY_ROW,
      },
      model: {
        kind: "parametric-cup",
        topDiameterMm: 90,
        bottomDiameterMm: 60,
        heightMm: 110,
        bandTopOffsetMm: 6,
        bandBottomOffsetMm: 8,
        seamMm: 8,
      },
    });
    // The areas the mock computes agree with the cup geometry (the storefront schema checks the sector).
    expect(
      customizationTemplateSchema.safeParse({ ...config, printAreas: config.printAreas }).success,
    ).toBe(true);
  });

  it("on the wire model3d is always there, has no url, and the nulls are omitted", async () => {
    const withFile = await api.get<unknown>(base(SEED.productId, SEED.variantId));
    const [row] = withFile.data as { model3d: Record<string, unknown> }[];
    expect(row?.model3d).toEqual({
      hasFile: true,
      fileName: "sample-cup-12oz.glb",
      fileChecksum: SEED_SHA,
      surfaces: BODY_ROW,
    });
    expect(row).not.toHaveProperty("modelFileChecksum");

    plantTemplate({ surfaces: [] });
    const without = await api.get<unknown>(base(EMPTY.productId, EMPTY.variantId));
    const [legacy] = without.data as { model3d: Record<string, unknown> }[];
    expect(legacy?.model3d).toEqual({ hasFile: false, surfaces: [] });
  });

  it("the seed sits on a product the screen can edit: PRD-001 / SKU-001-WHT-L", () => {
    expect(SEED).toEqual({ productId: "PRD-001", variantId: "SKU-001-WHT-L" });
  });

  it("a customizable variant without a configuration: null, not an error", async () => {
    expect(await getPrintConfig(EMPTY.productId, EMPTY.variantId)).toBeNull();
  });

  it("a variant of a standard product: BE answers an empty list, so null", async () => {
    expect(await getPrintConfig(STANDARD.productId, STANDARD.variantId)).toBeNull();
  });

  it("unknown product or variant: 404, not swallowed", async () => {
    expect((await apiError(getPrintConfig("NOPE", "x"))).code).toBe("PRODUCT_NOT_FOUND");
    expect((await apiError(getPrintConfig(SEED.productId, "x"))).code).toBe("VARIANT_NOT_FOUND");
  });

  it("GET one template; an unknown template is 404 PRINT_CONFIG_NOT_FOUND", async () => {
    const one = await api.get<unknown>(seedPath());
    expect(one.data).toMatchObject({ templateId: "tpl-seed-cup12-body", version: 3 });
    const error = await apiError(api.get(`${base(SEED.productId, SEED.variantId)}/nope`));
    expect([error.status, error.code]).toEqual([404, "PRINT_CONFIG_NOT_FOUND"]);
  });
});

describe("GET model-file/download-url", () => {
  it("a template with a file: a link and its expiry", async () => {
    const config = await seeded();
    const link = await getModelFileLink(SEED.productId, SEED.variantId, config.templateId);
    expect(link.url).toBe(SAMPLE_URL);
    expect(Date.parse(link.expiresAt ?? "")).toBeGreaterThan(Date.now());
  });

  it("a template without a file: 404 NOT_FOUND", async () => {
    plantTemplate();
    const error = await apiError(getModelFileLink(EMPTY.productId, EMPTY.variantId, "tpl-legacy"));
    expect([error.status, error.code]).toEqual([404, "NOT_FOUND"]);
  });
});

describe("PUT …/model-file is gone", () => {
  it("no save of the app calls it: create, update with a file, update without, every request seen by the client", async () => {
    const put = vi.spyOn(api, "put");
    const post = vi.spyOn(api, "post");
    const requests = captureRequests();
    try {
      const created = await savePrintConfig(EMPTY.productId, EMPTY.variantId, {
        config: CUP_BODY,
        stored: null,
        file: glbBytes("new.glb"),
      });
      const replaced = await savePrintConfig(EMPTY.productId, EMPTY.variantId, {
        config: { ...CUP_BODY, model: { ...CUP, heightMm: 120 } },
        stored: storedOf(created),
        file: glbBytes("taller.glb", 24),
      });
      await savePrintConfig(EMPTY.productId, EMPTY.variantId, {
        config: { ...CUP_BODY, model: { ...CUP, heightMm: 120, seamMm: 9 } },
        stored: storedOf(replaced),
      });
    } finally {
      requests.stop();
    }
    const urls = [...put.mock.calls, ...post.mock.calls].map(([url]) => String(url));
    expect(urls).toHaveLength(3);
    expect(requests.seen).toHaveLength(3);
    for (const url of [...urls, ...requests.seen.map((r) => String(r.url))]) {
      expect(url).not.toMatch(/\/model-file(\?|$)/);
    }
    put.mockRestore();
    post.mockRestore();
  });

  it("the mock answers it 404 NOT_FOUND in the BE's error body, as the BE does, and changes nothing", async () => {
    const before = await seeded();
    const form = new FormData();
    form.append("file", new File([glbBytes("x.glb", 8).bytes], "x.glb"));
    const error = await apiError(
      api.put(`${seedPath()}/model-file`, form, {
        ...MULTIPART,
        params: { version: before.version },
      }),
    );
    expect([error.status, error.code]).toEqual([404, "NOT_FOUND"]);
    expect(await seeded()).toEqual(before);
  });
});

describe("POST: a template is created with its file, in one multipart request", () => {
  it("201: the file stored with the BE's own SHA-256, the table and the measurements together", async () => {
    const file = glbBytes("my-cup.glb", 64);
    const { status, data } = await post(multipart(rawBody({ code: "CUP-NEW" }), file));
    expect(status).toBe(201);
    expect(data).toMatchObject({
      code: "CUP-NEW",
      active: false,
      model: { topDiameterMm: 90 },
      model3d: { hasFile: true, fileName: "my-cup.glb", surfaces: BODY_ROW },
    });
    expect(data).toMatchObject({ model3d: { fileChecksum: await sha256Hex(file.bytes) } });
  });

  it("a bag is created with four computed faces", async () => {
    const { data } = await post(multipart(rawBag({ code: "BAG-NEW" }), glbBytes("bag.glb")));
    const areas = (data as { printAreas: { code: string; widthMm: number }[] }).printAreas;
    expect(areas.map((a) => a.code)).toEqual(["FRONT", "BACK", "LEFT", "RIGHT"]);
    expect(areas[2]?.widthMm).toBe(110);
  });

  it.each([
    ["plain JSON", () => rawBody({ code: "CUP-X" })],
    ["multipart without a file", () => multipart(rawBody({ code: "CUP-X" }))],
    [
      "multipart with an empty file part",
      () => multipart(rawBody({ code: "CUP-X" }), glbBytes("x.glb", 0)),
    ],
  ])("%s: 409 PRINT_CONFIG_MODEL_FILE_REQUIRED, nothing created", async (_name, body) => {
    const error = await apiError(post(body()));
    expect([error.status, error.code]).toEqual([409, "PRINT_CONFIG_MODEL_FILE_REQUIRED"]);
    expect(await getPrintConfig(EMPTY.productId, EMPTY.variantId)).toBeNull();
  });

  it("the part template must be typed application/json (415), and is required (400)", async () => {
    const asText = new FormData();
    asText.append("template", JSON.stringify(rawBody({ code: "CUP-X" })));
    asText.append("file", new File([glbBytes().bytes], "x.glb"));
    const text = await apiError(post(asText));
    expect([text.status, text.code]).toEqual([415, "UNSUPPORTED_MEDIA_TYPE"]);
    const fileOnly = new FormData();
    fileOnly.append("file", new File([glbBytes().bytes], "x.glb"));
    const missing = await apiError(post(fileOnly));
    expect([missing.status, missing.code]).toEqual([400, "VALIDATION_FAILED"]);
  });

  it("with a file the table is complete: a missing area is 422 PrintAreaMissing, another mesh name MeshNameMismatch", async () => {
    const bag = rawBag({
      code: "BAG-X",
      model3d: {
        surfaces: [
          { printAreaCode: "FRONT", meshName: "print:FRONT" },
          { printAreaCode: "BACK", meshName: "Back_face" },
          { printAreaCode: "LEFT", meshName: "print:LEFT" },
        ],
      },
    });
    const error = await apiError(post(multipart(bag, glbBytes("bag.glb"))));
    expect([error.status, error.code]).toEqual([422, "PRINT_CONFIG_SURFACES_INVALID"]);
    expect(error.fieldErrorList?.map(({ field, code }) => [field, code])).toEqual([
      ["model3d.surfaces[1].meshName", "MeshNameMismatch"],
      ["model3d.surfaces", "PrintAreaMissing"],
    ]);
    expect(await getPrintConfig(EMPTY.productId, EMPTY.variantId)).toBeNull();
  });
});

describe("PUT with a new file: one multipart request, all or nothing", () => {
  it("measurements, table and file stored together; the version may move by more than one", async () => {
    const before = await seeded();
    const file = glbBytes("taller.glb", 40);
    const { data } = await put(
      seedPath(),
      multipart(rawBody({ version: before.version, model: { ...CUP, heightMm: 120 } }), file),
    );
    expect(data).toMatchObject({
      model: { heightMm: 120 },
      model3d: { fileName: "taller.glb", fileChecksum: await sha256Hex(file.bytes) },
    });
    const after = await seeded();
    expect(after.version).toBe(before.version + 2);
    expect(after.version).toBe((data as { version: number }).version);
  });

  it.each([
    ["over 10 MB", glbBytes("big.glb", 10 * 1024 * 1024 + 1), 413, "PAYLOAD_TOO_LARGE"],
    ["not a .glb", glbBytes("model.txt", 16), 415, "UNSUPPORTED_MEDIA_TYPE"],
    [
      "refused by the virus scan",
      { name: "eicar.glb", bytes: new TextEncoder().encode(EICAR_PREFIX).buffer },
      400,
      "VALIDATION_FAILED",
    ],
  ])("a file %s is refused (%i %s) and nothing changes", async (_name, file, status, code) => {
    const before = await seeded();
    const changed = rawBody({ version: before.version, model: { ...CUP, heightMm: 120 } });
    const error = await apiError(put(seedPath(), multipart(changed, file)));
    expect([error.status, error.code]).toEqual([status, code]);
    expect(await seeded()).toEqual(before);
  });

  it("a stale version: 409 OPTIMISTIC_LOCK and nothing changes", async () => {
    const before = await seeded();
    const error = await apiError(
      put(seedPath(), multipart(rawBody({ version: before.version - 1 }), glbBytes())),
    );
    expect(error.code).toBe("OPTIMISTIC_LOCK");
    expect(await seeded()).toEqual(before);
  });
});

describe("PUT without a file: the values the file determines stay as they were read (ModelFileRules)", () => {
  it("free edits pass: name, margins, seam, rim, material; file and checksum stay; the version is the response's", async () => {
    const before = await seeded();
    const { data } = await put(
      seedPath(),
      rawBody({
        version: before.version,
        name: "Đổi tên",
        model: { ...CUP, seamMm: 9, rimMm: 4, material: "kraft" },
        printAreas: [{ code: "BODY", name: "Thân", safeMarginMm: 4, bleedMm: 3 }],
      }),
    );
    expect(data).toMatchObject({ name: "Đổi tên", model: { seamMm: 9, material: "kraft" } });
    const after = await seeded();
    expect(after.model3d).toEqual(before.model3d);
    expect(after.version).toBe((data as { version: number }).version);
    expect(after.version).toBeGreaterThan(before.version);
  });

  it.each([
    ["topDiameterMm", 91],
    ["bottomDiameterMm", 61],
    ["heightMm", 110.01],
    ["bandTopOffsetMm", 7],
    ["bandBottomOffsetMm", 9],
  ])(
    "a cup's %s changed: 409 PRINT_CONFIG_MODEL_FILE_REQUIRED, nothing changes",
    async (key, value) => {
      const before = await seeded();
      const error = await apiError(
        put(seedPath(), rawBody({ version: before.version, model: { ...CUP, [key]: value } })),
      );
      expect([error.status, error.code]).toEqual([409, "PRINT_CONFIG_MODEL_FILE_REQUIRED"]);
      expect(await seeded()).toEqual(before);
    },
  );

  it("compared in hundredths of a millimetre: 110.004 is the 110 that was stored", async () => {
    const before = await seeded();
    const { status } = await put(
      seedPath(),
      rawBody({ version: before.version, model: { ...CUP, heightMm: 110.004 } }),
    );
    expect(status).toBe(200);
  });

  it("the kind changed, or the table changed: 409; the table omitted: kept", async () => {
    const before = await seeded();
    const kind = await apiError(put(seedPath(), rawBag({ version: before.version })));
    expect(kind.code).toBe("PRINT_CONFIG_MODEL_FILE_REQUIRED");
    const renamed = rawBody({
      version: before.version,
      model3d: { surfaces: [{ printAreaCode: "BODY", meshName: "print:BODY-2" }] },
    });
    expect((await apiError(put(seedPath(), renamed))).code).toBe(
      "PRINT_CONFIG_MODEL_FILE_REQUIRED",
    );
    await put(seedPath(), withoutTable(rawBody({ version: before.version })));
    expect((await seeded()).model3d.surfaces).toEqual(BODY_ROW);
  });

  it("a bag: width, gusset and height less fold are the file's; the fold moves when the height moves with it", async () => {
    const bag = BAG_BODY.model;
    if (bag.kind !== "parametric-bag") throw new Error("bag fixture");
    plantTemplate({
      model: bag,
      areas: BAG_BODY.printAreas,
      surfaces: BAG_BODY.surfaces,
      file: { url: "u", name: "bag.glb", sizeBytes: 16, checksum: "c".repeat(64) },
    });
    const body = (model: object) => rawBag({ version: 4, model: { ...bag, ...model } });
    for (const [model, refused] of [
      [{ widthMm: 241 }, "model.widthMm"],
      [{ gussetMm: 111 }, "model.gussetMm"],
      [{ heightMm: 320 }, "heightMm - model.topFoldMm"],
      [{ topFoldMm: 40 }, "heightMm - model.topFoldMm"],
    ] as const) {
      const error = await apiError(put(legacyPath(), body(model)));
      expect(error.code).toBe("PRINT_CONFIG_MODEL_FILE_REQUIRED");
      expect(error.message).toContain(refused);
    }
    const { data } = await put(legacyPath(), body({ heightMm: 320, topFoldMm: 40 }));
    expect(data).toMatchObject({ model: { heightMm: 320, topFoldMm: 40 } });
  });
});

describe("templates written before the rules", () => {
  it("without a file: free edits only, until a file comes with the measurements", async () => {
    plantTemplate({ surfaces: [] });
    const free = rawBody({ version: 4, name: "Tên mới", model3d: { surfaces: [] } });
    const { data: renamed } = await put(legacyPath(), free);
    expect(renamed).toMatchObject({ name: "Tên mới", model3d: { hasFile: false } });
    const version = (renamed as { version: number }).version;
    const measured = rawBody({
      version,
      model: { ...CUP, heightMm: 120 },
      model3d: { surfaces: [] },
    });
    expect((await apiError(put(legacyPath(), measured))).code).toBe(
      "PRINT_CONFIG_MODEL_FILE_REQUIRED",
    );
    // With the file, a complete table is required, and the template is whole afterwards.
    const noTable = await apiError(put(legacyPath(), multipart(measured, glbBytes())));
    expect([noTable.status, noTable.code]).toEqual([422, "PRINT_CONFIG_SURFACES_INVALID"]);
    const whole = rawBody({ version, model: { ...CUP, heightMm: 120 } });
    const { data } = await put(legacyPath(), multipart(whole, glbBytes("cup.glb")));
    expect(data).toMatchObject({ model3d: { hasFile: true, surfaces: BODY_ROW } });
  });

  it("with a file but a misnamed mesh: every edit without a file is refused (422), even a name only", async () => {
    const misnamed = [{ printAreaCode: "BODY" as const, meshName: "Body" }];
    plantTemplate({
      surfaces: misnamed,
      file: { url: "u", name: "old.glb", sizeBytes: 16, checksum: "c".repeat(64) },
    });
    const nameOnly = rawBody({ version: 4, name: "Chỉ đổi tên", model3d: { surfaces: misnamed } });
    const sent = await apiError(put(legacyPath(), nameOnly));
    expect([sent.status, sent.code]).toEqual([422, "PRINT_CONFIG_SURFACES_INVALID"]);
    expect(sent.fieldErrorList?.[0]).toMatchObject({
      field: "model3d.surfaces[0].meshName",
      code: "MeshNameMismatch",
    });
    expect((await apiError(put(legacyPath(), withoutTable(nameOnly)))).code).toBe(
      "PRINT_CONFIG_SURFACES_INVALID",
    );
    // Fixed only by sending the file again with a correct table.
    const { data } = await put(legacyPath(), multipart(rawBody({ version: 4 }), glbBytes()));
    expect(data).toMatchObject({ model3d: { surfaces: BODY_ROW } });
  });
});

describe("activation needs a file and a complete table", () => {
  const activate = (version: number) => api.post(`${legacyPath()}/activation`, { version });

  it("no file: 409 PRINT_CONFIG_MODEL_FILE_REQUIRED", async () => {
    plantTemplate();
    const error = await apiError(activate(4));
    expect([error.status, error.code]).toEqual([409, "PRINT_CONFIG_MODEL_FILE_REQUIRED"]);
  });

  it("a file with an area not on its print:<code> mesh: 422 PRINT_CONFIG_SURFACES_INVALID", async () => {
    plantTemplate({
      surfaces: [],
      file: { url: "u", name: "old.glb", sizeBytes: 16, checksum: "c".repeat(64) },
    });
    const error = await apiError(activate(4));
    expect([error.status, error.code]).toEqual([422, "PRINT_CONFIG_SURFACES_INVALID"]);
    expect(error.fieldErrorList?.[0]).toMatchObject({
      field: "model3d.surfaces",
      code: "PrintAreaMissing",
    });
  });

  it("a file and a complete table: activated", async () => {
    plantTemplate({ file: { url: "u", name: "ok.glb", sizeBytes: 16, checksum: "c".repeat(64) } });
    const { data } = await activate(4);
    expect(data).toMatchObject({ active: true, version: 5 });
  });
});

describe("the BE's other refusals, as the mock answers them", () => {
  it("a variant of a non-customizable product: 409 PRODUCT_NOT_CUSTOMIZABLE", async () => {
    const error = await apiError(
      post(
        multipart(rawBody({ code: "CUP-X" }), glbBytes()),
        base(STANDARD.productId, STANDARD.variantId),
      ),
    );
    expect([error.status, error.code]).toEqual([409, "PRODUCT_NOT_CUSTOMIZABLE"]);
  });

  it("a code the variant already has: 409 PRINT_CONFIG_CODE_TAKEN", async () => {
    const error = await apiError(
      post(
        multipart(rawBody({ code: CUP_BODY.code }), glbBytes()),
        base(SEED.productId, SEED.variantId),
      ),
    );
    expect([error.status, error.code]).toEqual([409, "PRINT_CONFIG_CODE_TAKEN"]);
  });

  it("a missing print area: 400 PRINT_CONFIG_INVALID", async () => {
    const bag = rawBag({ code: "BAG-X", printAreas: BAG_BODY.printAreas.slice(0, 3) });
    const error = await apiError(post(multipart(bag, glbBytes())));
    expect([error.status, error.code]).toEqual([400, "PRINT_CONFIG_INVALID"]);
  });

  it("a table naming an unknown or repeated area, or an empty mesh: 422 with the field and code of each fault", async () => {
    const error = await apiError(
      put(
        seedPath(),
        rawBody({
          version: await versionOf(),
          model3d: {
            surfaces: [
              { printAreaCode: "BODY", meshName: "print:BODY" },
              { printAreaCode: "BODY", meshName: "" },
              { printAreaCode: "FRONT", meshName: "print:FRONT" },
            ],
          },
        }),
      ),
    );
    expect([error.status, error.code]).toEqual([422, "PRINT_CONFIG_SURFACES_INVALID"]);
    expect(error.fieldErrorList?.map(({ field, code }) => [field, code])).toEqual([
      ["model3d.surfaces[1].printAreaCode", "PrintAreaDuplicate"],
      ["model3d.surfaces[1].meshName", "Size"],
      ["model3d.surfaces[2].printAreaCode", "PrintAreaUnknown"],
    ]);
  });

  it("an update without `version`: 400 VALIDATION_FAILED, JSON and multipart alike", async () => {
    expect((await apiError(put(seedPath(), rawBody()))).code).toBe("VALIDATION_FAILED");
    expect((await apiError(put(seedPath(), multipart(rawBody(), glbBytes())))).code).toBe(
      "VALIDATION_FAILED",
    );
  });
});

describe("the mock answers in the BE envelope, and the client's own unwrap runs on it", () => {
  /** The handler's raw answer, before the client's response interceptor. */
  async function raw(method: string, url: string, data?: unknown) {
    const route = resolveMockRoute(method, url);
    if (!route) throw new Error(`no mock route ${method} ${url}`);
    return route.handler({ url, data, _mockParams: route.params } as AxiosRequestConfig);
  }

  it("every success is { success: true, data }, whatever the status", async () => {
    const seed = await seeded(); // also makes sure the mock routes are registered
    const answers = [
      await raw("GET", base(SEED.productId, SEED.variantId)),
      await raw("GET", seedPath()),
      await raw("GET", `${seedPath()}/model-file/download-url`),
      await raw(
        "POST",
        base(EMPTY.productId, EMPTY.variantId),
        multipart(rawBody({ code: "CUP-RAW" }), glbBytes()),
      ),
      await raw("PUT", seedPath(), rawBody({ version: seed.version })),
    ];
    const after = await seeded();
    answers.push(await raw("POST", `${seedPath()}/deactivation`, { version: after.version }));
    expect(answers.map((a) => a.status)).toEqual([200, 200, 200, 201, 200, 200]);
    for (const answer of answers) {
      expect(answer.data).toMatchObject({ success: true });
      expect(answer.data).toHaveProperty("data");
    }
    expect((answers[1]?.data as { data: { templateId: string } }).data.templateId).toBe(
      "tpl-seed-cup12-body",
    );
  });

  it("every refusal is the BE error body: success false, errorCode, message, fieldErrors", async () => {
    await seeded();
    const unknownVariant = await raw("GET", base(SEED.productId, "SKU-NOPE"));
    expect(unknownVariant.status).toBe(404);
    expect(unknownVariant.data).toEqual({
      success: false,
      errorCode: "VARIANT_NOT_FOUND",
      message: expect.any(String),
      fieldErrors: [],
    });
    const invalid = await raw("PUT", seedPath(), rawBody({ name: "" }));
    expect(invalid.data).toMatchObject({
      success: false,
      errorCode: "VALIDATION_FAILED",
      fieldErrors: [{ field: "name", message: expect.any(String) }],
    });
  });

  it("the client unwraps both: the screens' code reads the payload, and an error is an ApiError with the BE code", async () => {
    const list = await api.get<unknown>(base(SEED.productId, SEED.variantId));
    expect(Array.isArray(list.data)).toBe(true); // not { success, data }
    const error = await apiError(api.get(base(SEED.productId, "SKU-NOPE")));
    expect([error.status, error.code]).toEqual([404, "VARIANT_NOT_FOUND"]);
  });
});

describe("the mock checks in the BE's order", () => {
  it("an update without a file, stale version AND a draft the service refuses: the version lock answers first", async () => {
    const before = await seeded();
    const badAreas = { printAreas: BAG_BODY.printAreas };
    const stale = await apiError(
      put(seedPath(), rawBody({ version: before.version - 1, ...badAreas })),
    );
    expect([stale.status, stale.code]).toEqual([409, "OPTIMISTIC_LOCK"]);
    // at the current version the same draft is refused for what it is
    const invalid = await apiError(
      put(seedPath(), rawBody({ version: before.version, ...badAreas })),
    );
    expect([invalid.status, invalid.code]).toEqual([400, "PRINT_CONFIG_INVALID"]);
    expect(await seeded()).toEqual(before);
  });

  it("with a file the draft and the file are checked before any lock (no lock held while the file is scanned)", async () => {
    const before = await seeded();
    const tooBig = glbBytes("big.glb", 10 * 1024 * 1024 + 1);
    const error = await apiError(put(seedPath(), multipart(rawBody({ version: 0 }), tooBig)));
    expect(error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(await seeded()).toEqual(before);
  });

  it("an update of an unknown template: PRINT_CONFIG_NOT_FOUND", async () => {
    const error = await apiError(
      put(`${base(SEED.productId, SEED.variantId)}/nope`, rawBody({ version: 1 })),
    );
    expect([error.status, error.code]).toEqual([404, "PRINT_CONFIG_NOT_FOUND"]);
  });

  it("a create without a file is refused for that before the product is looked at", async () => {
    const error = await apiError(
      post(rawBody({ code: "CUP-X" }), base(STANDARD.productId, "SKU-NOPE")),
    );
    expect(error.code).toBe("PRINT_CONFIG_MODEL_FILE_REQUIRED");
  });

  it("a write on a product that is not customizable is refused for that before the variant is looked up", async () => {
    const unknownVariant = `/products/${STANDARD.productId}/variants/SKU-NOPE/customization-templates`;
    const create = await apiError(
      post(multipart(rawBody({ code: "CUP-X" }), glbBytes()), unknownVariant),
    );
    expect([create.status, create.code]).toEqual([409, "PRODUCT_NOT_CUSTOMIZABLE"]);
    const update = await apiError(put(`${unknownVariant}/t`, rawBody({ version: 1 })));
    expect(update.code).toBe("PRODUCT_NOT_CUSTOMIZABLE");
    // a read of the same variant is a plain not-found
    expect((await apiError(api.get(unknownVariant))).code).toBe("VARIANT_NOT_FOUND");
  });
});
