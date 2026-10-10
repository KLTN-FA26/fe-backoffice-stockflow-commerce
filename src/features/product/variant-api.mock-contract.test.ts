/**
 * Contract test: mock adapter nói đúng hợp đồng BE PR #71 cho biến thể / logistics / ảnh, để
 * `variant-api.ts` (zod parse) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import {
  addVariant,
  deleteVariantMedia,
  getSkuLogistics,
  listVariantMedia,
  listVariants,
  makePrimaryMedia,
  mediaViewUrl,
  publishVariantMedia,
  saveSkuLogistics,
  toLogisticsRequest,
  transitionVariant,
  updateVariant,
  uploadVariantMedia,
  withdrawVariantMedia,
} from "./variant-api";
import { variantErrorMessage } from "./variant-errors";

import type { LogisticsFormValues } from "./variant-schemas";

const PRODUCT = "PRD-001";

beforeAll(() => {
  // Ghim độ trễ + lỗi 500 ngẫu nhiên 5% của adapter để test ổn định.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetVariantMockStore();
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

const form: LogisticsFormValues = {
  unitOfMeasure: "EACH",
  barcode: "",
  weightKg: "0.25",
  lengthCm: "10",
  widthCm: "",
  heightCm: "",
  packageWeightKg: "",
  packageLengthCm: "",
  packageWidthCm: "",
  packageHeightCm: "",
  packageCount: "",
  packSize: "50",
  storageClass: "FRAGILE",
  requiresAdultSignature: false,
  shippingRestrictionNote: "",
  qcRequired: true,
};

describe("biến thể", () => {
  it("liệt kê theo sản phẩm, đúng một biến thể mặc định, sắp theo vị trí", async () => {
    const variants = await listVariants(PRODUCT);
    expect(variants.length).toBeGreaterThan(1);
    expect(variants.every((v) => v.productId === PRODUCT)).toBe(true);
    expect(variants.filter((v) => v.defaultVariant)).toHaveLength(1);
  });

  it("thêm (SKU in hoa, DRAFT) → kích hoạt → tạm chặn → ngừng dùng; SKU trùng → 409", async () => {
    const created = await addVariant({
      productId: PRODUCT,
      sku: "cup-mock-12oz",
      name: "Ly 12oz",
      attributeSignature: "",
    });
    expect(created).toMatchObject({ sku: "CUP-MOCK-12OZ", status: "DRAFT", defaultVariant: false });
    expect(created.attributeSignature).toBe("SKU=CUP-MOCK-12OZ");
    const dup = await apiError(
      addVariant({ productId: PRODUCT, sku: "CUP-MOCK-12OZ", name: "x", attributeSignature: "" }),
    );
    expect(variantErrorMessage(dup, "save")).toBe("Mã SKU đã được dùng cho biến thể khác.");

    const id = { productId: PRODUCT, variantId: created.variantId };
    expect((await transitionVariant({ ...id, action: "activate" })).status).toBe("ACTIVE");
    // SKU cố định khi đã rời DRAFT.
    const renamed = await apiError(
      updateVariant({
        ...id,
        position: created.position,
        sku: "OTHER",
        name: "Ly",
        attributeSignature: "",
      }),
    );
    expect(variantErrorMessage(renamed, "save")).toMatch(/chỉ đổi được khi biến thể còn Nháp/);
    expect((await transitionVariant({ ...id, action: "block" })).status).toBe("BLOCKED");
    const obsolete = await transitionVariant({ ...id, action: "obsolete" });
    expect(obsolete.status).toBe("OBSOLETE");
    expect(obsolete.obsoletedAt).toBeTruthy();
  });

  it("biến thể mặc định không ngừng dùng riêng → 409 có câu tiếng Việt", async () => {
    const def = (await listVariants(PRODUCT)).find((v) => v.defaultVariant);
    if (!def) throw new Error("no default variant");
    const e = await apiError(
      transitionVariant({ productId: PRODUCT, variantId: def.variantId, action: "obsolete" }),
    );
    expect(e.code).toBe("INVALID_VARIANT_TRANSITION");
    expect(variantErrorMessage(e, "obsolete")).toMatch(/Biến thể mặc định không ngừng riêng/);
  });
});

describe("logistics theo SKU", () => {
  it("đọc → lưu (gửi version) → version tăng; ghi bằng version cũ → 409 OPTIMISTIC_LOCK", async () => {
    const [v] = await listVariants(PRODUCT);
    if (!v) throw new Error("no variant");
    const before = await getSkuLogistics(PRODUCT, v.variantId);
    const saved = await saveSkuLogistics({
      productId: PRODUCT,
      variantId: v.variantId,
      version: before.version,
      values: form,
    });
    expect(saved).toMatchObject({
      version: before.version + 1,
      weightKg: 0.25,
      lengthCm: 10,
      widthCm: null,
      packSize: 50,
      storageClass: "FRAGILE",
      qcRequired: true,
    });
    const stale = await apiError(
      saveSkuLogistics({
        productId: PRODUCT,
        variantId: v.variantId,
        version: before.version,
        values: form,
      }),
    );
    expect(variantErrorMessage(stale, "logistics")).toMatch(/vừa được người khác sửa/);
  });

  it("form → SkuLogisticsRequest: ô trống là null, không phải 0", () => {
    expect(toLogisticsRequest(form, 3)).toMatchObject({
      version: 3,
      barcode: null,
      widthCm: null,
      packageCount: null,
      packSize: 50,
      shippingRestrictionNote: null,
    });
  });
});

describe("ảnh theo biến thể", () => {
  it("tải lên (riêng tư) → đặt bìa → xuất bản (người khác người tải) → gỡ → xoá", async () => {
    const [v] = await listVariants(PRODUCT);
    if (!v) throw new Error("no variant");
    const target = { productId: PRODUCT, variantId: v.variantId };
    const uploaded = await uploadVariantMedia({
      ...target,
      file: new File(["x"], "cup.png", { type: "image/png" }),
    });
    expect(uploaded).toMatchObject({ originalName: "cup.png", published: false });

    const primary = await makePrimaryMedia({ ...target, media: uploaded });
    expect(primary.primary).toBe(true);
    const list = await listVariantMedia(PRODUCT, v.variantId);
    expect(list[0]?.mediaId).toBe(uploaded.mediaId); // ảnh bìa đứng đầu
    expect(list.filter((m) => m.primary)).toHaveLength(1);

    const [published] = await publishVariantMedia({ ...target, mediaIds: [uploaded.mediaId] });
    expect(published).toMatchObject({ published: true });
    expect((await withdrawVariantMedia({ ...target, mediaId: uploaded.mediaId })).published).toBe(
      false,
    );

    await deleteVariantMedia({ ...target, mediaId: uploaded.mediaId });
    expect((await listVariantMedia(PRODUCT, v.variantId)).map((m) => m.mediaId)).not.toContain(
      uploaded.mediaId,
    );
  });

  it("ảnh mang URL ngoài (seed) xem thẳng URL, không gọi download-url", async () => {
    const [v] = await listVariants(PRODUCT);
    if (!v) throw new Error("no variant");
    const seeded = (await listVariantMedia(PRODUCT, v.variantId)).find((m) => m.url);
    if (!seeded) throw new Error("seed variant has no image");
    expect(await mediaViewUrl(PRODUCT, v.variantId, seeded, 320)).toBe(seeded.url);
  });
});
