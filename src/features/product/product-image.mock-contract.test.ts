/**
 * Contract test: mock adapter nói đúng hợp đồng BE cho ảnh riêng của sản phẩm (ADR-0012), ảnh trong mô tả và mô tả
 * riêng của biến thể (ADR-0013), để `product-image-api.ts` / `description-api.ts` (zod parse) chạy y hệt trên mock và
 * BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductHistoryMock } from "@/lib/api/mock-product-history";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetProductImageMockStore } from "@/lib/api/mock-routes-product-images";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { createProduct, listBrands, listCategories, transitionProduct } from "./api";
import { setVariantDescription, uploadDescriptionImage } from "./description-api";
import {
  deleteProductImage,
  describeProductImage,
  getProductImage,
  uploadProductImage,
} from "./product-image-api";
import { listVariants } from "./variant-api";

beforeAll(() => {
  // Ghim độ trễ + lỗi 500 ngẫu nhiên của adapter để test ổn định.
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetProductHistoryMock();
  resetVariantMockStore();
  resetProductImageMockStore();
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
async function draft() {
  const [category] = (await listCategories()).items;
  const [brand] = await listBrands();
  n += 1;
  return createProduct({
    code: `IMG-${Date.now()}-${n}`,
    name: "Ly giấy",
    categoryId: category?.categoryId ?? "",
    brandId: brand?.brandId ?? "",
    description: "<p>Ly giấy <strong>12oz</strong></p>",
    taxClass: "STANDARD",
  });
}

const png = (name = "ly.png") => new File(["x"], name, { type: "image/png" });

describe("ảnh riêng của sản phẩm (BE /products/{id}/image, ADR-0012)", () => {
  it("chưa có ảnh → null; tải lên, sửa chữ thay thế, thay ảnh, gỡ ảnh", async () => {
    const product = await draft();
    expect(await getProductImage(product.productId)).toBeNull();

    const uploaded = await uploadProductImage({
      productId: product.productId,
      file: png(),
      altText: " Mặt trước ",
    });
    expect(uploaded).toMatchObject({ originalName: "ly.png", altText: "Mặt trước" });

    const described = await describeProductImage({ productId: product.productId, altText: "Mới" });
    expect(described.altText).toBe("Mới");

    const replaced = await uploadProductImage({
      productId: product.productId,
      file: png("ly-2.png"),
    });
    expect(replaced.originalName).toBe("ly-2.png");
    expect((await getProductImage(product.productId))?.originalName).toBe("ly-2.png");

    await deleteProductImage({ productId: product.productId });
    expect(await getProductImage(product.productId)).toBeNull();
  });

  it("sản phẩm chờ duyệt: không nhận ảnh (409)", async () => {
    const product = await draft();
    await transitionProduct({ id: product.productId, action: "submit" });
    const error = await apiError(uploadProductImage({ productId: product.productId, file: png() }));
    expect(error.status).toBe(409);
  });
});

describe("mô tả rich text (ADR-0013)", () => {
  it("mô tả sản phẩm là HTML, đi nguyên qua POST /products", async () => {
    const product = await draft();
    expect(product.description).toBe("<p>Ly giấy <strong>12oz</strong></p>");
  });

  it("ảnh trong mô tả: trả URL dùng được ngay", async () => {
    const product = await draft();
    const image = await uploadDescriptionImage({ productId: product.productId, file: png() });
    expect(image.url).toBeTruthy();
    expect(image.renditions.length).toBeGreaterThan(0);
  });

  it("mô tả riêng của biến thể: lưu, rồi để trống thì gỡ (null)", async () => {
    const product = await draft();
    const [variant] = await listVariants(product.productId);
    if (!variant) throw new Error("product has no default variant");

    const saved = await setVariantDescription({
      productId: product.productId,
      variantId: variant.variantId,
      html: "<p>Màu trắng</p>",
    });
    expect(saved.description).toBe("<p>Màu trắng</p>");

    const cleared = await setVariantDescription({
      productId: product.productId,
      variantId: variant.variantId,
      html: "  ",
    });
    expect(cleared.description ?? null).toBeNull();
  });
});
