/**
 * Contract test: mock adapter nói đúng hợp đồng BE `SkuPurchasingController` để `purchasing-api.ts`
 * (zod parse + kiểm đúng biến thể) chạy y hệt trên mock và BE thật — kể cả `version` dùng chung của
 * hồ sơ hàng tồn với PUT chính sách tồn và "NCC ưu tiên" của danh mục NCC.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductHistoryMock } from "@/lib/api/mock-product-history";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetSkuPurchasingMockStore } from "@/lib/api/mock-routes-sku-purchasing";
import {
  resetSupplierItemMockStore,
  seedMockSupplierItem,
} from "@/lib/api/mock-routes-supplier-items-store";
import { resetSupplierMockStore } from "@/lib/api/mock-routes-suppliers";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import { fetchSkuSuppliers } from "@/lib/references/sku-suppliers";

import { listProductVersions } from "./lifecycle-api";
import { getSkuPurchasing, saveSkuPurchasing } from "./purchasing-api";
import { isPurchasingVersionConflict } from "./purchasing-errors";
import { purchasingValuesOf } from "./purchasing-schemas";
import { transitionVariant } from "./variant-api";

import type { SkuPurchasingValues } from "./purchasing-schemas";

const PRODUCT = "PRD-001";
const VARIANT = "SKU-001-BLK-L";
const SUPPLIER = "SUP-001";
const OTHER_SUPPLIER = "SUP-002";

// Mỗi request mock trễ ~350ms (Math.random = 0.5).
vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => {
  // Ghim độ trễ + lỗi 500 ngẫu nhiên 5% của adapter để test ổn định.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});

beforeEach(() => {
  resetVariantMockStore();
  resetProductMockStore();
  resetProductHistoryMock();
  resetSupplierMockStore();
  resetSupplierItemMockStore();
  resetSkuPurchasingMockStore();
});

afterAll(() => vi.restoreAllMocks());

async function apiError(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  if (!(e instanceof ApiError)) throw new Error(`expected ApiError, got ${String(e)}`);
  return e;
}

const full: SkuPurchasingValues = {
  defaultSupplierId: SUPPLIER,
  referencePurchasePrice: "12500.5",
  referencePurchaseCurrency: "VND",
  leadTimeDays: 0,
  moq: 24,
};

const save = (version: number, values: SkuPurchasingValues, variantId = VARIANT) =>
  saveSkuPurchasing({ productId: PRODUCT, variantId, version, values });

/** Version hiện tại của hồ sơ hàng tồn qua route `/inventory/items/{id}` thật của mock. */
async function itemVersion(variantId = VARIANT): Promise<number> {
  const { data } = await api.get<{ version: number }>(`/inventory/items/item-${variantId}`);
  return data.version;
}

describe("GET purchasing (mock)", () => {
  it("SKU chưa khai báo: 200, mọi field null, version là của hồ sơ hàng tồn", async () => {
    const purchasing = await getSkuPurchasing(PRODUCT, VARIANT);
    expect(purchasing).toEqual({
      variantId: VARIANT,
      sku: VARIANT,
      version: await itemVersion(),
      defaultSupplierId: null,
      referencePurchasePrice: null,
      referencePurchaseCurrency: null,
      leadTimeDays: null,
      moq: null,
    });
  });

  it("wire bỏ field null như Jackson non_null (không gửi `null`)", async () => {
    const { data } = await api.get<Record<string, unknown>>(
      `/products/${PRODUCT}/variants/${VARIANT}/purchasing`,
    );
    expect(Object.keys(data).sort()).toEqual(["sku", "variantId", "version"]);
  });

  it("sản phẩm / biến thể không có, hoặc biến thể của sản phẩm khác → 404 theo mã BE", async () => {
    expect((await apiError(getSkuPurchasing("PRD-404", VARIANT))).code).toBe("PRODUCT_NOT_FOUND");
    expect((await apiError(getSkuPurchasing(PRODUCT, "SKU-404"))).code).toBe("NOT_FOUND");
    // SKU-002-WHT là biến thể của PRD-002, không phải của PRD-001
    expect((await apiError(getSkuPurchasing(PRODUCT, "SKU-002-WHT"))).code).toBe("NOT_FOUND");
  });
});

describe("PUT purchasing (mock)", () => {
  it("thay toàn bộ, tăng version dùng chung đúng 1, GET đọc lại đúng giá trị", async () => {
    const before = await getSkuPurchasing(PRODUCT, VARIANT);
    const saved = await save(before.version, full);
    expect(saved).toMatchObject({
      version: before.version + 1,
      defaultSupplierId: SUPPLIER,
      referencePurchasePrice: "12500.5",
      referencePurchaseCurrency: "VND",
      leadTimeDays: 0,
      moq: 24,
    });
    expect(await itemVersion()).toBe(before.version + 1);
    expect(await getSkuPurchasing(PRODUCT, VARIANT)).toEqual(saved);
  });

  it("null tường minh xoá field; lưu không đổi gì vẫn tăng version như BE", async () => {
    const first = await save((await getSkuPurchasing(PRODUCT, VARIANT)).version, full);
    const cleared = await save(first.version, {
      ...purchasingValuesOf(first),
      referencePurchasePrice: null,
      referencePurchaseCurrency: null,
      moq: null,
    });
    expect(cleared).toMatchObject({
      version: first.version + 1,
      defaultSupplierId: SUPPLIER,
      leadTimeDays: 0,
      referencePurchasePrice: null,
      referencePurchaseCurrency: null,
      moq: null,
    });
    const same = await save(cleared.version, purchasingValuesOf(cleared));
    expect(same.version).toBe(cleared.version + 1);
  });

  it("version cũ → 409 OPTIMISTIC_LOCK, không ghi gì", async () => {
    const before = await getSkuPurchasing(PRODUCT, VARIANT);
    await save(before.version, full);
    const e = await apiError(save(before.version, { ...full, moq: 99 }));
    expect(e.status).toBe(409);
    expect(isPurchasingVersionConflict(e)).toBe(true);
    expect((await getSkuPurchasing(PRODUCT, VARIANT)).moq).toBe(24);
  });

  it("PUT chính sách tồn tăng cùng version → bản đã đọc của thông tin mua hàng thành cũ", async () => {
    const read = await getSkuPurchasing(PRODUCT, VARIANT);
    const { data: item } = await api.get<{ version: number; policy: Record<string, unknown> }>(
      `/inventory/items/item-${VARIANT}`,
    );
    await api.put(`/inventory/items/item-${VARIANT}/policy`, {
      ...item.policy,
      version: item.version,
    });
    expect(isPurchasingVersionConflict(await apiError(save(read.version, full)))).toBe(true);
    const fresh = await getSkuPurchasing(PRODUCT, VARIANT);
    expect(fresh.version).toBe(read.version + 1);
    await expect(save(fresh.version, full)).resolves.toMatchObject({ version: fresh.version + 1 });
  });

  it("dữ liệu sai đi tới BE (bỏ qua kiểm FE) → 400 VALIDATION_FAILED đúng field + mã constraint", async () => {
    const version = (await getSkuPurchasing(PRODUCT, VARIANT)).version;
    const path = `/products/${PRODUCT}/variants/${VARIANT}/purchasing`;
    const bad = await apiError(
      api.put(path, { version, leadTimeDays: 366, moq: 0, referencePurchasePrice: 1.005 }),
    );
    expect(bad.code).toBe("VALIDATION_FAILED");
    expect(bad.fieldCodes).toEqual({
      leadTimeDays: "Max",
      moq: "Min",
      referencePurchasePrice: "Digits",
    });
    const noVersion = await apiError(api.put(path, { moq: 1 }));
    expect(noVersion.fieldCodes).toEqual({ version: "NotNull" });
    const pairing = await apiError(api.put(path, { version, referencePurchasePrice: 100 }));
    expect(pairing.fieldCodes).toEqual({ referencePurchaseCurrency: "VALIDATION_FAILED" });
  });

  it("sản phẩm chờ duyệt / ngừng kinh doanh → 409 CONFLICT; biến thể đã ngừng → VARIANT_OBSOLETE", async () => {
    const pending = await apiError(
      saveSkuPurchasing({
        productId: "PRD-004",
        variantId: "SKU-004-BLK-L",
        version: 0,
        values: full,
      }),
    );
    expect(pending.code).toBe("CONFLICT");
    expect(isPurchasingVersionConflict(pending)).toBe(false);
    await transitionVariant({
      productId: PRODUCT,
      variantId: "SKU-001-NVY-XL",
      action: "obsolete",
    });
    const obsolete = await apiError(save(0, full, "SKU-001-NVY-XL"));
    expect(obsolete.code).toBe("VARIANT_OBSOLETE");
  });

  it("đổi sang NCC không có → 404 SUPPLIER_NOT_FOUND", async () => {
    const version = (await getSkuPurchasing(PRODUCT, VARIANT)).version;
    const e = await apiError(save(version, { ...full, defaultSupplierId: "SUP-999" }));
    expect(e.code).toBe("SUPPLIER_NOT_FOUND");
  });

  it("ghi lịch sử PURCHASING của sản phẩm chỉ khi có field đổi", async () => {
    const version = (await getSkuPurchasing(PRODUCT, VARIANT)).version;
    const saved = await save(version, full);
    await save(saved.version, purchasingValuesOf(saved));
    const history = await listProductVersions(PRODUCT, { page: 0, size: 20 });
    const purchasing = history.items.filter((row) => row.changeType === "PURCHASING");
    expect(purchasing).toHaveLength(1);
    expect(purchasing[0]?.subjectId).toBe(VARIANT);
  });
});

describe("NCC mặc định ↔ danh mục NCC (mock)", () => {
  it("PUT đổi NCC mặc định → cột 'ưu tiên' của danh mục đổi theo, NCC mặc định đứng đầu", async () => {
    seedMockSupplierItem({ supplierId: SUPPLIER, sku: VARIANT, price: 100, currency: "VND" });
    seedMockSupplierItem({ supplierId: OTHER_SUPPLIER, sku: VARIANT, price: 90, currency: "VND" });
    const version = (await getSkuPurchasing(PRODUCT, VARIANT)).version;
    await save(version, { ...full, defaultSupplierId: OTHER_SUPPLIER });
    // danh mục mock còn gieo thêm NCC từ dòng PO cho SKU này — chỉ đúng một dòng ưu tiên, đứng đầu
    const suppliers = await fetchSkuSuppliers(VARIANT);
    expect(suppliers[0]).toMatchObject({ supplierId: OTHER_SUPPLIER, preferred: true });
    expect(suppliers.filter((s) => s.preferred)).toHaveLength(1);
    expect(suppliers.find((s) => s.supplierId === SUPPLIER)?.preferred).toBe(false);
  });

  it("bỏ / đặt 'ưu tiên' ở danh mục NCC đổi defaultSupplierId và tăng version chỉ khi giá trị đổi", async () => {
    const seeded = seedMockSupplierItem({
      supplierId: SUPPLIER,
      sku: VARIANT,
      price: 100,
      currency: "VND",
      preferred: true,
    });
    const before = await getSkuPurchasing(PRODUCT, VARIANT);
    expect(before.defaultSupplierId).toBe(SUPPLIER);
    const body = (preferred: boolean, version: number) => ({
      price: 100,
      moq: 1,
      packSize: 1,
      leadTimeDays: null,
      preferred,
      version,
    });
    const itemPath = `/suppliers/${SUPPLIER}/items/${seeded.supplierItemId}`;
    // đã ưu tiên sẵn → giữ nguyên ưu tiên không tăng version hồ sơ
    const { data: kept } = await api.put<{ version: number }>(itemPath, body(true, 0));
    expect((await getSkuPurchasing(PRODUCT, VARIANT)).version).toBe(before.version);
    // bỏ ưu tiên trên NCC đang mặc định → xoá NCC mặc định, tăng version đúng 1
    await api.put(itemPath, body(false, kept.version));
    const after = await getSkuPurchasing(PRODUCT, VARIANT);
    expect(after.defaultSupplierId).toBeNull();
    expect(after.version).toBe(before.version + 1);
    // bản thông tin mua hàng đọc trước đó giờ đã cũ
    expect(isPurchasingVersionConflict(await apiError(save(before.version, full)))).toBe(true);
  });

  it("giữ NCC mặc định cũ không kiểm lại NCC; xoá NCC mặc định bằng null", async () => {
    seedMockSupplierItem({
      supplierId: SUPPLIER,
      sku: VARIANT,
      price: 100,
      currency: "VND",
      preferred: true,
    });
    const before = await getSkuPurchasing(PRODUCT, VARIANT);
    const cleared = await save(before.version, { ...full, defaultSupplierId: null });
    expect(cleared.defaultSupplierId).toBeNull();
    const suppliers = await fetchSkuSuppliers(VARIANT);
    expect(suppliers.every((s) => !s.preferred)).toBe(true);
  });
});
