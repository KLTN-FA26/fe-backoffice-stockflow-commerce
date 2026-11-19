/**
 * Đổi SKU của biến thể NHÁP (Step 5C.1) — đúng hợp đồng BE `ProductVariantService.update` +
 * `inventory.guard_item_sku_rename` (V20261008000200) + `inventory.item_in_use`:
 * - chỉ biến thể DRAFT và SKU chưa được dùng (vd chưa có dòng danh mục NCC) mới đổi được, không thì 409
 *   INVALID_VARIANT_TRANSITION và không có gì đổi;
 * - hồ sơ hàng tồn giữ nguyên (cùng id), SKU đi theo (ON UPDATE CASCADE), `version` + 1 — đơn vị tính
 *   (kể cả thùng) nằm trên hồ sơ nên đi theo.
 * Chạy qua mock adapter thật; chỉ `/identity/me/permissions` được trả tay.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS, UI_LABELS, VARIANT_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import {
  UNPRICED_CUSTOMER,
  findCustomerPrice,
  resetCustomerPriceMockStore,
  seedMockCustomerPrice,
} from "@/lib/api/mock-customer-price-store";
import { resetCustomerMockStore } from "@/lib/api/mock-customer-store";
import { resetProductHistoryMock } from "@/lib/api/mock-product-history";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetUomConversionMockStore } from "@/lib/api/mock-routes-uom-conversions";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import { getInventoryItem } from "@/features/inventory-item/api";

import { createProduct, listBrands, listCategories } from "../../api";
import { addAttributeValue, createAttribute } from "../../attribute-api";
import { replaceProductAxes } from "../../axes-api";
import { listSkuUnits } from "../../carton-api";
import { renderApp } from "../../product-test-utils";
import { addVariant, listVariants, updateVariant } from "../../variant-api";
import { useUpdateVariant, variantKeys } from "../../variant-queries";
import { VariantPanel } from "./VariantPanel";

import type { Variant } from "../../variant-schemas";

const L = UI_LABELS.cartonSpec;

vi.setConfig({ testTimeout: 30_000 });
const passThrough = api.get.bind(api);

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  resetVariantMockStore();
  resetProductMockStore();
  resetProductHistoryMock();
  resetUomConversionMockStore();
  resetCustomerMockStore();
  resetCustomerPriceMockStore();
});
afterEach(() => vi.restoreAllMocks());

let seq = 0;
/** Sản phẩm NHÁP không trục → một biến thể mặc định DRAFT, SKU = mã sản phẩm. */
async function draftVariant(): Promise<{ productId: string; variant: Variant }> {
  seq += 1;
  const [category] = (await listCategories()).items;
  const [brand] = await listBrands();
  const product = await createProduct({
    code: `RN-${Date.now().toString(36)}-${seq}`.toUpperCase(),
    name: "Sản phẩm đổi SKU",
    nameEn: "Rename product",
    categoryId: category?.categoryId ?? "",
    brandId: brand?.brandId ?? "",
    description: "",
    descriptionEn: "",
    taxClass: "STANDARD",
  });
  const [variant] = await listVariants(product.productId);
  if (!variant || variant.status !== "DRAFT") throw new Error("expected a DRAFT default variant");
  return { productId: product.productId, variant };
}

const rename = (productId: string, variant: Variant, sku: string) =>
  updateVariant({
    productId,
    variantId: variant.variantId,
    position: variant.position,
    sku,
    name: variant.name,
    optionValueIds: [],
  });

describe("mock = BE khi đổi SKU của biến thể nháp", () => {
  it("đổi được: cùng variantId; hồ sơ hàng tồn cùng id mang SKU mới, version + 1; đơn vị tính đi theo", async () => {
    const { productId, variant } = await draftVariant();
    const before = await listSkuUnits(productId, variant.variantId);
    const itemBefore = await getInventoryItem(variant.inventoryItemId ?? "");
    const next = `${variant.sku}-NEW`;

    const renamed = await rename(productId, variant, next);
    expect(renamed.variantId).toBe(variant.variantId);
    expect(renamed.sku).toBe(next);

    const after = await listSkuUnits(productId, variant.variantId);
    expect(after).toEqual(before.map((unit) => ({ ...unit, sku: next })));
    const itemAfter = await getInventoryItem(variant.inventoryItemId ?? "");
    expect(itemAfter.sku).toBe(next);
    expect(itemAfter.version).toBe(itemBefore.version + 1);
  });
});

/** Bấm để đổi SKU qua đúng hook của màn biến thể (cùng QueryClient với panel). */
function RenameButton({
  productId,
  variant,
  sku,
}: {
  productId: string;
  variant: Variant;
  sku: string;
}) {
  const update = useUpdateVariant();
  return (
    <button
      type="button"
      onClick={() =>
        update.mutate({
          productId,
          variantId: variant.variantId,
          position: variant.position,
          sku,
          name: variant.name,
          optionValueIds: [],
        })
      }
    >
      đổi SKU
    </button>
  );
}

describe("cache FE sau khi đổi SKU", () => {
  it("mục quy cách thùng tải lại theo SKU mới; khai báo thùng ngay sau đó thành công", async () => {
    const { productId, variant } = await draftVariant();
    const next = `${variant.sku}-NEW`;
    vi.spyOn(api, "get").mockImplementation(async (url, config) =>
      url === "/identity/me/permissions"
        ? {
            data: {
              roles: ["TEST"],
              permissions: [
                PRODUCT_PERMISSIONS.read,
                PRODUCT_PERMISSIONS.update,
                VARIANT_PERMISSIONS.read,
                VARIANT_PERMISSIONS.update,
              ],
              dataScope: "ALL",
            },
          }
        : passThrough(url, config),
    );
    const post = vi.spyOn(api, "post");
    const { client } = renderApp(
      <>
        <VariantPanel
          productId={productId}
          variant={variant}
          productApproved={false}
          acceptsChanges
          customizable={false}
          open
          onClose={() => {}}
        />
        <RenameButton productId={productId} variant={variant} sku={next} />
      </>,
    );
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const key = variantKeys.units(productId, variant.variantId);
    await waitFor(() => expect(client.getQueryData(key)).toBeDefined());

    // panel là dialog modal → nút ngoài panel bị ẩn khỏi cây trợ năng
    await user.click(screen.getByRole("button", { name: "đổi SKU", hidden: true }));
    await waitFor(() => expect(client.getQueryData<{ sku: string }[]>(key)?.[0]?.sku).toBe(next));

    await user.click(await screen.findByRole("button", { name: L.declare }));
    await user.type(screen.getByLabelText(L.dialog.unitsPerCarton), "50");
    await user.click(screen.getByRole("button", { name: L.dialog.submitCreate }));
    const unitPosts = () =>
      post.mock.calls.filter(([url]) => String(url).endsWith("/uom-conversions"));
    await waitFor(() => expect(unitPosts()).toHaveLength(1));
    expect(unitPosts()[0]?.[1]).toMatchObject({ unitOfMeasure: "CARTON", factor: 50 });
    await waitFor(() =>
      expect(client.getQueryData<{ sku: string; factor: number }[]>(key)).toContainEqual(
        expect.objectContaining({ sku: next, factor: 50 }),
      ),
    );
  });
});

/**
 * Step 5C.2 — BE `inventory.item_in_use` coi bảng giá riêng của khách (`catalog.customer_price`) là tham
 * chiếu: SKU đã có giá riêng thì KHÔNG đổi được (409 INVALID_VARIANT_TRANSITION), ở cả hai đường đổi SKU
 * (PUT biến thể nháp; POST gán tổ hợp đầu cho biến thể mặc định nháp kèm SKU mới). Không chuyển giá sang SKU mới.
 */
describe("bảng giá khách hàng chặn đổi SKU như BE", () => {
  const PRICES = "/catalog/customer-prices";

  async function inventorySnapshot(productId: string, variant: Variant) {
    return {
      variants: (await listVariants(productId)).map((v) => v.sku),
      item: await getInventoryItem(variant.inventoryItemId ?? ""),
      units: await listSkuUnits(productId, variant.variantId),
    };
  }
  const apiCode = async (p: Promise<unknown>) => {
    const error = await p.then(
      () => null,
      (e: unknown) => e,
    );
    return error instanceof ApiError ? `${error.status} ${error.code}` : "no error";
  };

  it("PUT: SKU có giá riêng (tạo qua API giá) → 409 INVALID_VARIANT_TRANSITION, không kho nào đổi", async () => {
    const { productId, variant } = await draftVariant();
    await api.post(`${PRICES}/${UNPRICED_CUSTOMER}/${variant.sku}`, {
      tiers: [{ minQuantity: 1, unitPrice: 50000 }],
      note: null,
    });
    const before = await inventorySnapshot(productId, variant);
    const price = findCustomerPrice(UNPRICED_CUSTOMER, variant.sku);

    expect(await apiCode(rename(productId, variant, `${variant.sku}-NEW`))).toBe(
      "409 INVALID_VARIANT_TRANSITION",
    );
    expect(await inventorySnapshot(productId, variant)).toEqual(before);
    expect(findCustomerPrice(UNPRICED_CUSTOMER, variant.sku)).toEqual(price);
    expect(findCustomerPrice(UNPRICED_CUSTOMER, `${variant.sku}-NEW`)).toBeNull();
  });

  it("chưa gọi route giá nào (giá gieo thẳng vào kho) vẫn bị chặn — không phụ thuộc thứ tự khởi tạo route", async () => {
    const { productId, variant } = await draftVariant();
    seedMockCustomerPrice({
      customerId: UNPRICED_CUSTOMER,
      sku: variant.sku,
      tiers: [{ minQuantity: 1, unitPrice: "50000" }],
      note: null,
      version: 0,
    });
    expect(await apiCode(rename(productId, variant, `${variant.sku}-NEW`))).toBe(
      "409 INVALID_VARIANT_TRANSITION",
    );
  });

  it("POST gán tổ hợp đầu cho biến thể mặc định nháp kèm SKU mới: cũng bị chặn khi SKU có giá riêng", async () => {
    const { productId, variant } = await draftVariant();
    let axis = await createAttribute({
      code: `RNAX${Date.now()}`,
      dataType: "SELECT",
      name: "Trục đổi SKU",
      unit: "",
      filterable: true,
      searchable: false,
      sortOrder: "",
      active: true,
    });
    axis = await addAttributeValue({
      attributeId: axis.attributeId,
      values: {
        code: "X1",
        label: "X1",
        valueNumber: "",
        hexColor: "",
        sortOrder: "0",
        active: true,
      },
    });
    const valueId = axis.values[0]?.valueId ?? "";
    await replaceProductAxes({
      productId,
      axes: [{ attributeId: axis.attributeId, optionValueIds: [valueId] }],
    });
    seedMockCustomerPrice({
      customerId: UNPRICED_CUSTOMER,
      sku: variant.sku,
      tiers: [{ minQuantity: 1, unitPrice: "50000" }],
      note: null,
      version: 0,
    });
    const before = await inventorySnapshot(productId, variant);
    const add = addVariant({
      productId,
      sku: `${variant.sku}-NEW`,
      name: variant.name,
      optionValueIds: [valueId],
    });
    expect(await apiCode(add)).toBe("409 INVALID_VARIANT_TRANSITION");
    expect(await inventorySnapshot(productId, variant)).toEqual(before);
  });

  it("POST gán tổ hợp đầu kèm SKU mới, SKU chưa được dùng → đổi được như PUT (hồ sơ + đơn vị tính đi theo)", async () => {
    const { productId, variant } = await draftVariant();
    let axis = await createAttribute({
      code: `RNAY${Date.now()}`,
      dataType: "SELECT",
      name: "Trục đổi SKU",
      unit: "",
      filterable: true,
      searchable: false,
      sortOrder: "",
      active: true,
    });
    axis = await addAttributeValue({
      attributeId: axis.attributeId,
      values: {
        code: "Y1",
        label: "Y1",
        valueNumber: "",
        hexColor: "",
        sortOrder: "0",
        active: true,
      },
    });
    const valueId = axis.values[0]?.valueId ?? "";
    await replaceProductAxes({
      productId,
      axes: [{ attributeId: axis.attributeId, optionValueIds: [valueId] }],
    });
    const before = await listSkuUnits(productId, variant.variantId);
    const next = `${variant.sku}-NEW`;
    const renamed = await addVariant({
      productId,
      sku: next,
      name: variant.name,
      optionValueIds: [valueId],
    });
    expect(renamed).toMatchObject({ variantId: variant.variantId, sku: next });
    expect(await listSkuUnits(productId, variant.variantId)).toEqual(
      before.map((unit) => ({ ...unit, sku: next })),
    );
  });

  it("đặt lại kho (reset) giữa các lần không làm mất / nhân đôi đăng ký: vẫn chặn đúng một lần", async () => {
    const { productId, variant } = await draftVariant();
    resetCustomerPriceMockStore();
    seedMockCustomerPrice({
      customerId: UNPRICED_CUSTOMER,
      sku: variant.sku,
      tiers: [{ minQuantity: 1, unitPrice: "50000" }],
      note: null,
      version: 0,
    });
    expect(await apiCode(rename(productId, variant, `${variant.sku}-NEW`))).toBe(
      "409 INVALID_VARIANT_TRANSITION",
    );
    resetCustomerPriceMockStore();
    // không còn giá riêng → không còn tham chiếu → đổi được
    expect(await apiCode(rename(productId, variant, `${variant.sku}-NEW`))).toBe("no error");
  });
});
