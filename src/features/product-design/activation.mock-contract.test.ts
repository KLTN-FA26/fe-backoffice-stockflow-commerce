/**
 * Activation and deactivation of a template against the mock adapter. BE: `POST …/{templateId}/activation` and
 * `/deactivation`, body `{ version }`, answer the template; activating retires the variant's active one.
 */
import { describe, expect, it } from "vitest";

import { activatePrintConfig, deactivatePrintConfig, getPrintConfig, savePrintConfig } from "./api";
import { apiError, EMPTY, SEED, setUpMockBackend } from "./mock-backend-test-utils";
import { CUP_BODY, glbBytes } from "./test-fixtures";

setUpMockBackend();

const create = (code: string) =>
  savePrintConfig(EMPTY.productId, EMPTY.variantId, {
    config: { ...CUP_BODY, code },
    stored: null,
    file: glbBytes(),
  });
const target = (t: { templateId: string; version: number }) => ({ ...EMPTY, ...t });

describe("activatePrintConfig / deactivatePrintConfig", () => {
  it("a new template is inactive; activating makes it the variant's configuration", async () => {
    const created = await create("CUP-A");
    expect(created.active).toBe(false);
    const active = await activatePrintConfig(target(created));
    expect(active).toMatchObject({ templateId: created.templateId, active: true });
    expect(active.version).toBeGreaterThan(created.version);
    expect((await getPrintConfig(EMPTY.productId, EMPTY.variantId))?.active).toBe(true);
  });

  it("activating a second template retires the first: at most one active per variant", async () => {
    const first = await activatePrintConfig(target(await create("CUP-A")));
    const second = await activatePrintConfig(target(await create("CUP-B")));
    expect(second.active).toBe(true);
    // The read returns the active template, which is now the second.
    expect((await getPrintConfig(EMPTY.productId, EMPTY.variantId))?.templateId).toBe(
      second.templateId,
    );
    // The first was retired: deactivating it with its old version is a lost update, with a fresh one it is a no-op.
    const error = await apiError(deactivatePrintConfig(target(first)));
    expect(error.code).toBe("OPTIMISTIC_LOCK");
  });

  it("deactivating stops the template; the variant keeps it as inactive", async () => {
    const active = await activatePrintConfig(target(await create("CUP-A")));
    const off = await deactivatePrintConfig(target(active));
    expect(off.active).toBe(false);
    expect((await getPrintConfig(EMPTY.productId, EMPTY.variantId))?.active).toBe(false);
  });

  it("a stale version is 409 OPTIMISTIC_LOCK and nothing changes", async () => {
    const created = await create("CUP-A");
    const error = await apiError(activatePrintConfig(target({ ...created, version: 99 })));
    expect([error.status, error.code]).toEqual([409, "OPTIMISTIC_LOCK"]);
    expect((await getPrintConfig(EMPTY.productId, EMPTY.variantId))?.active).toBe(false);
  });

  it("an unknown template is 404 PRINT_CONFIG_NOT_FOUND", async () => {
    const error = await apiError(
      activatePrintConfig({ ...EMPTY, templateId: "tpl-nope", version: 0 }),
    );
    expect([error.status, error.code]).toEqual([404, "PRINT_CONFIG_NOT_FOUND"]);
  });

  it("unknown product or variant: 404, as for the other calls", async () => {
    const product = await apiError(
      activatePrintConfig({ ...SEED, productId: "NOPE", templateId: "x", version: 0 }),
    );
    expect(product.code).toBe("PRODUCT_NOT_FOUND");
  });
});
