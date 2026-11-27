/**
 * Contract test: mock adapter nói đúng hợp đồng BE `UomConversionController` để `carton-api.ts` (parse
 * zod) chạy y hệt trên mock và BE thật — thứ tự kiểm theo `SkuUnitService` / `UomConversionServiceImpl`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductHistoryMock } from "@/lib/api/mock-product-history";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetUomConversionMockStore } from "@/lib/api/mock-routes-uom-conversions";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { createProduct, listBrands, listCategories, transitionProduct } from "./api";
import { deleteSkuUnit, listSkuUnits, retireSkuUnit, saveCartonSpec } from "./carton-api";
import { cartonFormValuesOf, cartonOf } from "./carton-schemas";
import { listVariants } from "./variant-api";

vi.setConfig({ testTimeout: 60_000 });

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetProductHistoryMock();
  resetVariantMockStore();
  resetUomConversionMockStore();
  activateMockAdapter();
});

afterAll(() => vi.restoreAllMocks());

async function apiError(p: Promise<unknown>) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
}

let n = 0;
async function draftVariant() {
  const [category] = (await listCategories()).items;
  const [brand] = await listBrands();
  n += 1;
  const product = await createProduct({
    code: `UOM-${Date.now()}-${n}`,
    name: "Sản phẩm quy cách thùng",
    categoryId: category?.categoryId ?? "",
    brandId: brand?.brandId ?? "",
    description: "",
    taxClass: "STANDARD",
  });
  const [variant] = await listVariants(product.productId);
  if (!variant) throw new Error("no default variant");
  return { productId: product.productId, variantId: variant.variantId, sku: variant.sku };
}

const values = (over: Partial<ReturnType<typeof cartonFormValuesOf>> = {}) => ({
  ...cartonFormValuesOf(null),
  unitsPerCarton: "1000",
  lengthCm: "40",
  widthCm: "30",
  heightCm: "25",
  weightKg: "10.5",
  ...over,
});

describe("đơn vị tính của SKU (BE /uom-conversions)", () => {
  it("đơn vị cơ sở đứng đầu, factor 1, mang SKU của biến thể", async () => {
    const { productId, variantId, sku } = await draftVariant();
    const units = await listSkuUnits(productId, variantId);
    expect(units[0]).toMatchObject({ sku, base: true, factor: 1, active: true });
  });

  it("khai báo thùng → là thùng của SKU (cartonOf); sửa kèm version tăng version", async () => {
    const { productId, variantId } = await draftVariant();
    const added = await saveCartonSpec({ productId, variantId, carton: null, values: values() });
    expect(added).toMatchObject({
      unitOfMeasure: "CARTON",
      factor: 1000,
      base: false,
      weightKg: 10.5,
      defaultShipping: true,
      version: 0,
    });
    const lookup = cartonOf(await listSkuUnits(productId, variantId));
    expect(lookup).toMatchObject({ kind: "carton", carton: { id: added.id } });

    const changed = await saveCartonSpec({
      productId,
      variantId,
      carton: added,
      values: values({ unitsPerCarton: "1200" }),
    });
    expect(changed).toMatchObject({ id: added.id, factor: 1200, version: 1 });
    // Đơn vị cơ sở mất dấu giao mặc định khi thùng nhận nó (BE `clearDefaultShipping`)
    const [base] = await listSkuUnits(productId, variantId);
    expect(base?.defaultShipping).toBe(false);
  });

  it("version cũ → 409 OPTIMISTIC_LOCK; mã đã có → 409 UOM_CONVERSION_DUPLICATE", async () => {
    const { productId, variantId } = await draftVariant();
    const added = await saveCartonSpec({ productId, variantId, carton: null, values: values() });
    await saveCartonSpec({ productId, variantId, carton: added, values: values() });
    const stale = await apiError(
      saveCartonSpec({ productId, variantId, carton: added, values: values() }),
    );
    expect(stale).toMatchObject({ status: 409, code: "OPTIMISTIC_LOCK" });
    const duplicate = await apiError(
      saveCartonSpec({ productId, variantId, carton: null, values: values() }),
    );
    expect(duplicate).toMatchObject({ status: 409, code: "UOM_CONVERSION_DUPLICATE" });
  });

  it("sản phẩm chờ duyệt → 409 CONFLICT khi ghi, vẫn đọc được; biến thể lạ → 404", async () => {
    const { productId, variantId } = await draftVariant();
    await transitionProduct({ id: productId, action: "submit" });
    const locked = await apiError(
      saveCartonSpec({ productId, variantId, carton: null, values: values() }),
    );
    expect(locked).toMatchObject({ status: 409, code: "CONFLICT" });
    expect((await listSkuUnits(productId, variantId)).length).toBeGreaterThan(0);
    expect((await apiError(listSkuUnits(productId, "không-có"))).status).toBe(404);
  });
});

describe("đổi quy cách thùng theo BR-10: khai báo thùng mới rồi ngưng / xoá thùng cũ", () => {
  it("thùng mới là giao mặc định → thành thùng; thùng cũ ngưng dùng được, xoá được; đơn vị cơ sở không xoá được", async () => {
    const { productId, variantId } = await draftVariant();
    const old = await saveCartonSpec({ productId, variantId, carton: null, values: values() });
    const fresh = await saveCartonSpec({
      productId,
      variantId,
      carton: null,
      values: values({ unitOfMeasure: "CARTON2", unitsPerCarton: "1200" }),
    });
    let units = await listSkuUnits(productId, variantId);
    expect(cartonOf(units)).toMatchObject({ kind: "carton", carton: { id: fresh.id } });

    const oldNow = units.find((u) => u.id === old.id);
    if (!oldNow) throw new Error("old carton missing");
    const retired = await retireSkuUnit({ productId, variantId, unit: oldNow });
    expect(retired).toMatchObject({
      active: false,
      defaultShipping: false,
      defaultPurchase: false,
    });

    await deleteSkuUnit({ productId, variantId, unit: retired });
    units = await listSkuUnits(productId, variantId);
    expect(units.some((u) => u.id === old.id)).toBe(false);

    const base = units.find((u) => u.base);
    if (!base) throw new Error("base unit missing");
    const refused = await apiError(deleteSkuUnit({ productId, variantId, unit: base }));
    expect(refused).toMatchObject({ status: 409, code: "UOM_CONVERSION_IN_USE" });
  });
});
