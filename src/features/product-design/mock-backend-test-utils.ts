/** Shared set-up of the tests that run `api.ts` against the mock adapter (reset stores, silence mock logging). */
import axios from "axios";
import { afterAll, beforeAll, beforeEach, expect, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import {
  SEED_PRINT_CONFIG_VARIANT,
  saveTemplate,
  templatesOf,
} from "@/lib/api/mock-print-config-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { getPrintConfig } from "./api";

import type { InternalAxiosRequestConfig } from "axios";
import type { MockPrintTemplate } from "@/lib/api/mock-print-config-store";

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

/** The seed's template row, as the mock store holds it. */
export function seedRow(): MockPrintTemplate {
  const row = templatesOf(SEED.variantId)[0];
  if (!row) throw new Error("seed missing");
  return row;
}

/**
 * Puts a template written before the BE's rules on the empty variant (the BE cannot create one any more): by default
 * the seed's cup without a file. `overrides` give other states (a file with a broken area ↔ mesh table, …).
 */
export function plantTemplate(overrides: Partial<MockPrintTemplate> = {}): MockPrintTemplate {
  const template: MockPrintTemplate = {
    ...seedRow(),
    templateId: "tpl-legacy",
    variantId: EMPTY.variantId,
    sku: EMPTY.variantId,
    code: "LEGACY",
    active: false,
    file: null,
    version: 4,
    ...overrides,
  };
  saveTemplate(template);
  return template;
}

/**
 * Every request as it leaves axios for the adapter: after the client's `transformRequest`, so a `FormData` turned into
 * JSON (the client's default content type) shows here. `stop()` puts the adapter back.
 */
export function captureRequests() {
  const seen: InternalAxiosRequestConfig[] = [];
  const original = api.defaults.adapter;
  const next = axios.getAdapter(original);
  api.defaults.adapter = (config) => {
    seen.push(config);
    return next(config);
  };
  return {
    seen,
    stop: () => {
      api.defaults.adapter = original;
    },
  };
}

/** A multipart body as the BE takes it: part `template` (JSON typed `application/json`) and, when given, part `file`. */
export function multipart(template: unknown, file?: { name: string; bytes: ArrayBuffer }) {
  const form = new FormData();
  form.append("template", new Blob([JSON.stringify(template)], { type: "application/json" }));
  if (file) form.append("file", new File([file.bytes], file.name));
  return form;
}

/** Clears the client's JSON default, as `api.ts` does for multipart. */
export const MULTIPART = { headers: { "Content-Type": false } } as const;
