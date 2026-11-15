/**
 * A save is one request that applies the template and the file together or neither (yêu cầu BE B-1, B-6), and the
 * checksum it stores is the hash of the bytes it sent.
 */
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { blobBytes } from "@/lib/crypto/blob-bytes";
import { sha256Hex } from "@/lib/crypto/sha256";

import { getPrintConfig, printConfigBody, printConfigForm, savePrintConfig } from "./api";
import { printConfigErrorMessage } from "./errors";
import { apiError, EMPTY, SEED, seeded, setUpMockBackend } from "./mock-backend-test-utils";
import { storedOf } from "./selectors";
import { CUP, CUP_BODY, glbBytes, SHA_B } from "./test-fixtures";

setUpMockBackend();

const SEED_SHA = "1faf14f6b7b9e7be5ac2d174dce76d7574ef5299387c001bdd0703943f65a7ea";
const path = (p: string, v: string) => `/products/${p}/variants/${v}/customization-templates`;
const MULTIPART = { headers: { "Content-Type": "multipart/form-data" } };
const taller = { ...CUP_BODY, model: { ...CUP, heightMm: 120 } };

describe("a failed save changes nothing", () => {
  const snapshot = async () => {
    const { version, model, model3d, modelFileChecksum } = await seeded();
    return { version, model, model3d, modelFileChecksum };
  };

  it("an old version with a new file and new numbers: 409, and the old numbers, file and checksum remain", async () => {
    const before = await snapshot();
    const stored = storedOf(await seeded());
    const error = await apiError(
      savePrintConfig(SEED.productId, SEED.variantId, {
        config: taller,
        stored: { ...stored, version: 0 },
        file: glbBytes("new.glb", 40),
      }),
    );
    expect(error.code).toBe("OPTIMISTIC_LOCK");
    expect(await snapshot()).toEqual(before);
  });

  it("a declared checksum that the file does not have: 422 in the one request, nothing stored", async () => {
    const before = await snapshot();
    const stored = storedOf(await seeded());
    const raw = api.put(
      `${path(SEED.productId, SEED.variantId)}/${stored.templateId}`,
      printConfigForm(printConfigBody(taller, SHA_B, stored), glbBytes("other.glb", 33)),
      MULTIPART,
    );
    const error = await apiError(raw);
    expect([error.status, error.code]).toEqual([422, "MODEL_FILE_CHECKSUM_MISMATCH"]);
    expect(await snapshot()).toEqual(before);
  });

  it("a new template whose request fails leaves the variant without one", async () => {
    const raw = api.post(
      path(EMPTY.productId, EMPTY.variantId),
      printConfigForm(printConfigBody(CUP_BODY, SHA_B, null), glbBytes("x.glb", 9)),
      MULTIPART,
    );
    expect((await apiError(raw)).code).toBe("MODEL_FILE_CHECKSUM_MISMATCH");
    expect(await getPrintConfig(EMPTY.productId, EMPTY.variantId)).toBeNull();
  });

  it("a repeated or unknown print area in the table is 422 (B-2)", async () => {
    const stored = storedOf(await seeded());
    const body = {
      ...printConfigBody(CUP_BODY, undefined, stored),
      model3d: { surfaces: [{ printAreaCode: "FRONT" as const, meshName: "print:FRONT" }] },
    };
    const bad = await apiError(
      api.put(
        `${path(SEED.productId, SEED.variantId)}/${stored.templateId}`,
        printConfigForm(body),
        MULTIPART,
      ),
    );
    expect(bad.status).toBe(422);
  });

  it("a code the variant already has is 409 PRINT_CONFIG_CODE_TAKEN", async () => {
    const error = await apiError(
      savePrintConfig(SEED.productId, SEED.variantId, { config: CUP_BODY, stored: null }),
    );
    expect(error.code).toBe("PRINT_CONFIG_CODE_TAKEN");
  });
});

describe("the checksum is the hash of the bytes sent", () => {
  it("with a file, a checksum the caller supplies is ignored: the stored one is the file's", async () => {
    const stored = storedOf(await seeded());
    const file = glbBytes("new.glb", 40);
    const saved = await savePrintConfig(SEED.productId, SEED.variantId, {
      config: taller,
      stored,
      file,
      modelFileChecksum: SHA_B,
    });
    expect(saved.modelFileChecksum).toBe(await sha256Hex(file.bytes));
    expect(saved.modelFileChecksum).not.toBe(SHA_B);
  });

  it("without a file, the supplied checksum is what the request declares", async () => {
    const put = vi.spyOn(api, "put");
    const stored = storedOf(await seeded());
    await savePrintConfig(SEED.productId, SEED.variantId, {
      config: taller,
      stored,
      modelFileChecksum: SEED_SHA,
    });
    const form = put.mock.calls[0]?.[1];
    put.mockRestore();
    if (!(form instanceof FormData)) throw new Error("the save is not multipart");
    const part = form.get("template");
    const body: unknown =
      part instanceof Blob ? JSON.parse(new TextDecoder().decode(await blobBytes(part))) : null;
    expect(body).toMatchObject({ modelFileChecksum: SEED_SHA });
    expect(form.get("file")).toBeNull();
  });
});

describe("a page without crypto.subtle (plain http on a LAN address)", () => {
  it("a save with a file fails before any request, with the mapped Vietnamese message", async () => {
    vi.stubGlobal("crypto", {});
    const post = vi.spyOn(api, "post");
    const error = await savePrintConfig(EMPTY.productId, EMPTY.variantId, {
      config: CUP_BODY,
      stored: null,
      file: glbBytes(),
    }).then(
      () => null,
      (e: unknown) => e,
    );
    vi.unstubAllGlobals();
    expect(post).not.toHaveBeenCalled();
    expect(printConfigErrorMessage(error)).toMatch(/https.*localhost/);
    post.mockRestore();
  });
});
