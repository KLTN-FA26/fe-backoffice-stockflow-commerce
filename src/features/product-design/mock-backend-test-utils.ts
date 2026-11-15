/** Shared set-up of the tests that run `api.ts` against the mock adapter (reset stores, silence mock logging). */
import { afterAll, beforeAll, beforeEach, expect, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { SEED_PRINT_CONFIG_VARIANT } from "@/lib/api/mock-print-config-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { getPrintConfig } from "./api";

/** Call inside a `describe` or at the top of a test file. */
export function setUpMockBackend(): void {
  // The first request loads every mock route module, which is slow on a cold start.
  vi.setConfig({ testTimeout: 60_000 });
  beforeAll(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    vi.spyOn(console, "info").mockImplementation(() => {});
    activateMockAdapter();
  });
  beforeEach(() => {
    resetProductMockStore();
    resetVariantMockStore();
    resetPrintConfigMockStore();
  });
  afterAll(() => vi.restoreAllMocks());
}

export const SEED = SEED_PRINT_CONFIG_VARIANT;
/** A customizable variant with no configuration, and a variant of a STANDARD product. */
export const EMPTY = { productId: "PRD-001", variantId: "SKU-001-BLK-L" };
export const STANDARD = { productId: "PRD-003", variantId: "SKU-003-WHT-L" };

export async function apiError(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
}

export async function seeded() {
  const config = await getPrintConfig(SEED.productId, SEED.variantId);
  if (!config) throw new Error("seed missing");
  return config;
}
