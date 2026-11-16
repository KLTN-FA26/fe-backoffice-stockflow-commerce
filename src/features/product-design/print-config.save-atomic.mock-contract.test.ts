/**
 * `savePrintConfig` against the mock BE (origin/develop d47ed4ae): ONE request per save, so template, measurements,
 * table and `.glb` are stored together or not at all; the multipart body reaches the server as multipart (the client's
 * JSON default does not turn it into JSON); the version is the response's; the stored checksum must be the measured
 * bytes'; and every save the BE is bound to refuse is stopped before any request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { EICAR_PREFIX } from "@/lib/api/mock-print-config-file";
import { printConfigMockFaults } from "@/lib/api/mock-routes-print-configs";
import { blobBytes } from "@/lib/crypto/blob-bytes";
import { sha256Hex } from "@/lib/crypto/sha256";

import { getPrintConfig, savePrintConfig } from "./api";
import { ModelFileMismatchError, printConfigErrorMessage } from "./errors";
import {
  apiError,
  captureRequests,
  EMPTY,
  plantTemplate,
  SEED,
  seeded,
  setUpMockBackend,
} from "./mock-backend-test-utils";
import { storedOf } from "./selectors";
import { BAG_BODY, CUP, CUP_BODY, glbBytes } from "./test-fixtures";

setUpMockBackend();

// These tests spy on `api` per test: put every spy back, then the shared ones `setUpMockBackend` installs once.
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const taller = { ...CUP_BODY, model: { ...CUP, heightMm: 120 } };
/** A change of a free default only: it needs no new file. */
const seamier = { ...CUP_BODY, model: { ...CUP, seamMm: 9 } };

async function caught(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => null,
    (error: unknown) => error,
  );
}

async function templatePart(form: unknown): Promise<Record<string, unknown>> {
  if (!(form instanceof FormData)) throw new Error("expected multipart");
  const part = form.get("template");
  if (!(part instanceof Blob)) throw new Error("expected a template part");
  return JSON.parse(new TextDecoder().decode(await blobBytes(part)));
}

describe("one request per save", () => {
  it("create: ONE multipart POST reaching the server as multipart, without a hand-set content type", async () => {
    const requests = captureRequests();
    const file = glbBytes("my-cup.glb", 64);
    const saved = await savePrintConfig(EMPTY.productId, EMPTY.variantId, {
      config: CUP_BODY,
      stored: null,
      file,
    }).finally(requests.stop);

    expect(requests.seen.map((r) => r.method)).toEqual(["post"]);
    const [sent] = requests.seen;
    // After `transformRequest`: still a FormData (not JSON), and no content type for the browser to keep.
    expect(sent?.data).toBeInstanceOf(FormData);
    expect(sent?.headers.getContentType()).toBeFalsy();
    const template = await templatePart(sent?.data);
    expect(template).toMatchObject({
      code: "CUP12-BODY",
      model3d: { surfaces: CUP_BODY.surfaces },
    });
    expect(template).not.toHaveProperty("version");
    expect(template).not.toHaveProperty("modelFileChecksum");
    const part = sent?.data instanceof FormData ? sent.data.get("file") : null;
    expect(part instanceof File && part.name).toBe("my-cup.glb");

    expect(saved.model3d).toMatchObject({
      hasFile: true,
      fileName: "my-cup.glb",
      fileChecksum: await sha256Hex(file.bytes),
    });
    expect(await getPrintConfig(EMPTY.productId, EMPTY.variantId)).toEqual(saved);
  });

  it("update with a new file: ONE multipart PUT, `version` in the template part; the new version is the response's", async () => {
    const before = await seeded();
    const requests = captureRequests();
    const file = glbBytes("new.glb", 40);
    const saved = await savePrintConfig(SEED.productId, SEED.variantId, {
      config: taller,
      stored: storedOf(before),
      file,
    }).finally(requests.stop);

    expect(requests.seen.map((r) => `${r.method} ${r.url}`)).toEqual([
      `put /products/PRD-001/variants/SKU-001-WHT-L/customization-templates/${before.templateId}`,
    ]);
    const template = await templatePart(requests.seen[0]?.data);
    expect(template).toMatchObject({ version: before.version, model: { heightMm: 120 } });
    expect(template).not.toHaveProperty("code");
    // The BE moved the version by two: the screen keeps what it answered, never `version + 1`.
    expect(saved.version).toBe(before.version + 2);
    expect(saved.model3d.fileChecksum).toBe(await sha256Hex(file.bytes));
    expect(await seeded()).toEqual(saved);
  });

  it("update without a file: ONE JSON PUT; the stored file and its checksum stay", async () => {
    const before = await seeded();
    const requests = captureRequests();
    const saved = await savePrintConfig(SEED.productId, SEED.variantId, {
      config: seamier,
      stored: storedOf(before),
    }).finally(requests.stop);
    expect(requests.seen).toHaveLength(1);
    expect(requests.seen[0]?.method).toBe("put");
    expect(requests.seen[0]?.headers.getContentType()).toBe("application/json");
    expect(saved.model).toMatchObject({ seamMm: 9 });
    expect(saved.model3d).toEqual(before.model3d);
    expect(saved.version).toBeGreaterThan(before.version);
  });

  it("a bag is created with four computed faces", async () => {
    const saved = await savePrintConfig(EMPTY.productId, EMPTY.variantId, {
      config: BAG_BODY,
      stored: null,
      file: glbBytes("bag.glb"),
    });
    expect(saved.printAreas.map((a) => a.code)).toEqual(["FRONT", "BACK", "LEFT", "RIGHT"]);
  });
});

describe("all or nothing", () => {
  it("a file the BE refuses (virus scan) leaves everything as it was: the old numbers, file and version", async () => {
    const before = await seeded();
    const infected = { name: "eicar.glb", bytes: new TextEncoder().encode(EICAR_PREFIX).buffer };
    const error = await apiError(
      savePrintConfig(SEED.productId, SEED.variantId, {
        config: taller,
        stored: storedOf(before),
        file: infected,
      }),
    );
    expect([error.status, error.code]).toEqual([400, "VALIDATION_FAILED"]);
    expect(printConfigErrorMessage(error)).toMatch(/quét virus/);
    expect(await seeded()).toEqual(before);
  });

  it("a stale version: 409 OPTIMISTIC_LOCK, nothing stored", async () => {
    const before = await seeded();
    const error = await apiError(
      savePrintConfig(SEED.productId, SEED.variantId, {
        config: taller,
        stored: { ...storedOf(before), version: before.version - 1 },
        file: glbBytes(),
      }),
    );
    expect(error.code).toBe("OPTIMISTIC_LOCK");
    expect(await seeded()).toEqual(before);
  });
});

describe("the checksum is the BE's hash of the stored bytes, compared with the measured bytes'", () => {
  it("when the server stored other bytes the save is not a success: ModelFileMismatchError, with its sentence", async () => {
    printConfigMockFaults.storeOtherBytes = true;
    const file = glbBytes("new.glb", 40);
    const error = await caught(
      savePrintConfig(SEED.productId, SEED.variantId, {
        config: taller,
        stored: storedOf(await seeded()),
        file,
      }),
    );
    expect(error).toBeInstanceOf(ModelFileMismatchError);
    expect(printConfigErrorMessage(error)).toMatch(/file khác/);
    expect((await seeded()).model3d.fileChecksum).not.toBe(await sha256Hex(file.bytes));
  });
});

describe("a save the BE is bound to refuse is not sent", () => {
  async function refusedBeforeSending(
    input: Parameters<typeof savePrintConfig>[2],
    variant: { productId: string; variantId: string } = SEED,
  ) {
    const requests = captureRequests();
    const error = await caught(
      savePrintConfig(variant.productId, variant.variantId, input).finally(requests.stop),
    );
    expect(error).toBeInstanceOf(Error);
    expect(requests.seen).toEqual([]);
    return error instanceof Error ? error.message : "";
  }

  it("a create without a file (BE 409)", async () => {
    const message = await refusedBeforeSending({ config: CUP_BODY, stored: null }, EMPTY);
    expect(message).toMatch(/phải tạo cùng file 3D/);
  });

  it("a measured value changed without a new file (BE 409)", async () => {
    const message = await refusedBeforeSending({
      config: taller,
      stored: storedOf(await seeded()),
    });
    expect(message).toMatch(/Số đo này lấy từ file 3D, hãy tải file mới cùng số đo/);
  });

  it("the table changed without a new file (BE 409)", async () => {
    const config = {
      ...seamier,
      surfaces: [{ printAreaCode: "BODY" as const, meshName: "print:BODY " }],
    };
    const stored = { ...storedOf(await seeded()), surfaces: [] };
    const message = await refusedBeforeSending({ config, stored });
    expect(message).toMatch(/Số đo này lấy từ file 3D/);
  });

  it("an area without its print:<code> mesh, with a file (BE 422): the message names the area", async () => {
    const config = {
      ...BAG_BODY,
      surfaces: BAG_BODY.surfaces.filter((s) => s.printAreaCode !== "LEFT"),
    };
    const message = await refusedBeforeSending({ config, stored: null, file: glbBytes() }, EMPTY);
    expect(message).toMatch(/Vùng in LEFT chưa có mesh print:LEFT/);
  });

  it("a misnamed mesh in the stored table of a template with a file, without a new file (BE 422)", async () => {
    const misnamed = [{ printAreaCode: "BODY" as const, meshName: "Body" }];
    const stored = { ...storedOf(await seeded()), surfaces: misnamed };
    const message = await refusedBeforeSending({
      config: { ...seamier, surfaces: misnamed },
      stored,
    });
    expect(message).toMatch(/Mesh của vùng in BODY phải tên là print:BODY/);
  });
});

describe("measured values are sent exactly as they were read", () => {
  it("figures stored with more decimals than the screen shows go back untouched, and the BE takes them", async () => {
    const odd = { ...CUP, topDiameterMm: 90.123456, heightMm: 110.004 };
    plantTemplate({
      model: odd,
      file: { url: "u", name: "cup.glb", sizeBytes: 16, checksum: "c".repeat(64) },
    });
    const stored = await getPrintConfig(EMPTY.productId, EMPTY.variantId);
    if (!stored) throw new Error("planted template missing");
    const put = vi.spyOn(api, "put");
    const saved = await savePrintConfig(EMPTY.productId, EMPTY.variantId, {
      config: { ...CUP_BODY, code: stored.code, model: { ...odd, seamMm: 9 } },
      stored: storedOf(stored),
    });
    expect(put.mock.calls[0]?.[1]).toMatchObject({
      model: { topDiameterMm: 90.123456, heightMm: 110.004 },
    });
    expect(saved.model).toMatchObject({ topDiameterMm: 90.123456, seamMm: 9 });
  });
});

describe("a page without crypto.subtle (plain http on a LAN address)", () => {
  it("a save with a file fails before any request, with the mapped Vietnamese message", async () => {
    vi.stubGlobal("crypto", {});
    const post = vi.spyOn(api, "post");
    const error = await caught(
      savePrintConfig(EMPTY.productId, EMPTY.variantId, {
        config: CUP_BODY,
        stored: null,
        file: glbBytes(),
      }),
    );
    vi.unstubAllGlobals();
    expect(post).not.toHaveBeenCalled();
    expect(printConfigErrorMessage(error)).toMatch(/https.*localhost/);
  });
});
