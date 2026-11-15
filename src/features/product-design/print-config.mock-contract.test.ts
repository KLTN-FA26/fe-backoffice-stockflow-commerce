/**
 * Contract test: the mock adapter speaks the BE contract of customization templates
 * (`CustomizationTemplateController`) plus the assumed one-request multipart save (yêu cầu BE B-1, B-2, B-3, B-6), so
 * that `api.ts` (zod at the boundary) runs the same on the mock and on the real BE.
 */
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { sha256Hex } from "@/lib/crypto/sha256";

import { getPrintConfig, printConfigBody, printConfigForm, savePrintConfig } from "./api";
import { customizationTemplateSchema } from "./model3d";
import {
  apiError,
  EMPTY,
  SEED,
  seeded,
  STANDARD,
  setUpMockBackend,
} from "./mock-backend-test-utils";
import { storedOf } from "./selectors";
import { BAG_BODY, CUP, CUP_BODY, glbBytes } from "./test-fixtures";

setUpMockBackend();

const SEED_SHA = "1faf14f6b7b9e7be5ac2d174dce76d7574ef5299387c001bdd0703943f65a7ea";
const SAMPLE_URL = "/mock/models/sample-cup-12oz.glb";
const path = (p: string, v: string) => `/products/${p}/variants/${v}/customization-templates`;
const MULTIPART = { headers: { "Content-Type": "multipart/form-data" } };
const taller = { ...CUP_BODY, model: { ...CUP, heightMm: 120 } };

describe("GET customization-templates", () => {
  it("the seeded variant has a configuration with the sample cup file and its measured figures", async () => {
    const config = await seeded();
    expect(config).toMatchObject({
      active: true,
      model3d: { url: SAMPLE_URL, surfaces: [{ printAreaCode: "BODY", meshName: "print:BODY" }] },
      modelFileChecksum: SEED_SHA,
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
});

describe("savePrintConfig", () => {
  it("creates a template and its file in ONE request; the file comes back with url and checksum", async () => {
    const post = vi.spyOn(api, "post");
    const put = vi.spyOn(api, "put");
    const file = glbBytes("my-cup.glb", 64);
    const saved = await savePrintConfig(EMPTY.productId, EMPTY.variantId, {
      config: CUP_BODY,
      stored: null,
      file,
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
    expect(post.mock.calls[0]?.[1]).toBeInstanceOf(FormData);
    expect(saved.model3d?.url).toEqual(expect.any(String));
    expect(saved.modelFileChecksum).toBe(await sha256Hex(file.bytes));
    expect(saved.active).toBe(false);
    expect(await getPrintConfig(EMPTY.productId, EMPTY.variantId)).toEqual(saved);
    post.mockRestore();
    put.mockRestore();
  });

  it("a replacement stores the new numbers, the new file and its checksum together", async () => {
    const stored = storedOf(await seeded());
    const file = glbBytes("new.glb", 40);
    const saved = await savePrintConfig(SEED.productId, SEED.variantId, {
      config: taller,
      stored,
      file,
    });
    expect(saved.model).toMatchObject({ heightMm: 120 });
    expect(saved.modelFileChecksum).toBe(await sha256Hex(file.bytes));
    expect(saved.model3d?.url).not.toBe(SAMPLE_URL);
    expect(saved.version).toBe(stored.version + 1);
    expect(await seeded()).toEqual(saved);
  });

  it("a bag is saved with four computed faces", async () => {
    const saved = await savePrintConfig(EMPTY.productId, EMPTY.variantId, {
      config: BAG_BODY,
      stored: null,
      file: glbBytes(),
    });
    expect(saved.printAreas.map((a) => a.code)).toEqual(["FRONT", "BACK", "LEFT", "RIGHT"]);
    expect(saved.printAreas[2]?.widthMm).toBe(110);
  });

  it("a variant of a non-customizable product answers 409 PRODUCT_NOT_CUSTOMIZABLE", async () => {
    const error = await apiError(
      savePrintConfig(STANDARD.productId, STANDARD.variantId, {
        config: CUP_BODY,
        stored: null,
        file: glbBytes(),
      }),
    );
    expect([error.status, error.code]).toEqual([409, "PRODUCT_NOT_CUSTOMIZABLE"]);
  });

  it("a save of only the defaults, without a file, keeps the stored file and checksum", async () => {
    const before = await seeded();
    const config = { ...CUP_BODY, model: { ...CUP, seamMm: 9 } };
    const saved = await savePrintConfig(SEED.productId, SEED.variantId, {
      config,
      stored: storedOf(before),
      modelFileChecksum: SEED_SHA,
    });
    expect(saved.model).toMatchObject({ seamMm: 9 });
    expect(saved.model3d).toEqual(before.model3d);
    expect(saved.modelFileChecksum).toBe(SEED_SHA);
  });

  it("B-6: a changed measured figure with the stored file's checksum is accepted, without a new file", async () => {
    const stored = storedOf(await seeded());
    const saved = await savePrintConfig(SEED.productId, SEED.variantId, {
      config: taller,
      stored,
      modelFileChecksum: SEED_SHA,
    });
    expect(saved.model).toMatchObject({ heightMm: 120 });
    expect(saved.version).toBe(stored.version + 1);
    expect(saved.modelFileChecksum).toBe(SEED_SHA);
  });

  it("B-6: a changed figure with no file and no checksum is refused (409 by the mock, by the schema first)", async () => {
    const stored = storedOf(await seeded());
    await expect(
      savePrintConfig(SEED.productId, SEED.variantId, { config: taller, stored }),
    ).rejects.toThrow();
    const raw = api.put(
      `${path(SEED.productId, SEED.variantId)}/${stored.templateId}`,
      printConfigForm(printConfigBody(taller, undefined, stored)),
      MULTIPART,
    );
    const error = await apiError(raw);
    expect([error.status, error.code]).toEqual([409, "MODEL_FILE_PAIR_REQUIRED"]);
  });
});
