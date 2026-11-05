/**
 * Contract test: mock adapter nói đúng hợp đồng BE PR #71 cho biến thể / ảnh (và `inventoryItemId`
 * của BE PR #119), để `variant-api.ts` (zod parse) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import { fetchInventoryItemSummary } from "@/lib/references/inventory-item-lookup";

import { getProductAttributes } from "./axes-api";
import {
  addVariant,
  deleteVariantMedia,
  listVariantMedia,
  listVariants,
  makePrimaryMedia,
  mediaViewUrl,
  publishVariantMedia,
  transitionVariant,
  updateVariant,
  uploadVariantMedia,
  withdrawVariantMedia,
} from "./variant-api";
import { variantErrorMessage } from "./variant-errors";

const PRODUCT = "PRD-001";
/** Sản phẩm mock không có trục (SKU duy nhất / không đủ bộ thuộc tính) — nhập SKU tay. */
const NO_AXES_PRODUCT = "PRD-005";

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

describe("biến thể", () => {
  it("liệt kê theo sản phẩm, đúng một biến thể mặc định, sắp theo vị trí", async () => {
    const variants = await listVariants(PRODUCT);
    expect(variants.length).toBeGreaterThan(1);
    expect(variants.every((v) => v.productId === PRODUCT)).toBe(true);
    expect(variants.filter((v) => v.defaultVariant)).toHaveLength(1);
  });

  it("thêm (SKU in hoa, DRAFT) → kích hoạt → tạm chặn → ngừng dùng; SKU trùng → 409", async () => {
    // Biến thể đầu tiên của sản phẩm là mặc định (không ngừng dùng riêng được) → thêm một cái trước.
    await addVariant({
      productId: NO_AXES_PRODUCT,
      sku: "NOAXES-DEFAULT",
      name: "Mặc định",
      optionValueIds: [],
    });
    const created = await addVariant({
      productId: NO_AXES_PRODUCT,
      sku: "cup-mock-12oz",
      name: "Ly 12oz",
      optionValueIds: [],
    });
    expect(created).toMatchObject({ sku: "CUP-MOCK-12OZ", status: "DRAFT", options: [] });
    const dup = await apiError(
      addVariant({
        productId: NO_AXES_PRODUCT,
        sku: "CUP-MOCK-12OZ",
        name: "x",
        optionValueIds: [],
      }),
    );
    expect(variantErrorMessage(dup, "save")).toMatch(/đã có ở một biến thể khác/);

    const id = { productId: NO_AXES_PRODUCT, variantId: created.variantId };
    expect((await transitionVariant({ ...id, action: "activate" })).status).toBe("ACTIVE");
    // SKU cố định khi đã rời DRAFT.
    const renamed = await apiError(
      updateVariant({
        ...id,
        position: created.position,
        sku: "OTHER",
        name: "Ly",
        optionValueIds: [],
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

describe("biến thể theo trục (BE PR #115/#116: optionValueIds, không còn attributeSignature)", () => {
  it("đọc trục của sản phẩm; sản phẩm không có trục trả danh sách rỗng", async () => {
    const axes = (await getProductAttributes(PRODUCT)).axes;
    expect(axes.map((a) => a.code)).toEqual(["COLOR", "SIZE"]);
    expect(axes[0]?.options.length).toBeGreaterThan(1);
    expect((await getProductAttributes(NO_AXES_PRODUCT)).axes).toEqual([]);
  });

  it("thêm bằng optionValueIds: SKU / tên bỏ trống do BE sinh, options trả về, trùng tổ hợp → 409", async () => {
    const axes = (await getProductAttributes(PRODUCT)).axes;
    const pick = (label: string, axisCode: string) =>
      axes.find((a) => a.code === axisCode)?.options.find((o) => o.label === label)?.valueId ?? "";
    const optionValueIds = [pick("Navy", "COLOR"), pick("M", "SIZE")];

    const created = await addVariant({ productId: PRODUCT, sku: "", name: "", optionValueIds });
    expect(created.status).toBe("DRAFT");
    expect(created.sku).toMatch(/^PRD-001-/);
    expect(created.options.map((o) => o.label)).toEqual(["Navy", "M"]);

    const dup = await apiError(
      addVariant({ productId: PRODUCT, sku: "", name: "", optionValueIds }),
    );
    expect(dup.code).toBe("VARIANT_SKU_ALREADY_EXISTS");

    // Sửa không gửi sku / name: BE giữ giá trị hiện tại.
    const renamed = await updateVariant({
      productId: PRODUCT,
      variantId: created.variantId,
      position: created.position,
      sku: "",
      name: "Navy M",
      optionValueIds,
    });
    expect(renamed).toMatchObject({ sku: created.sku, name: "Navy M" });
  });

  it("thiếu một trục / tuỳ chọn không thuộc sản phẩm / sản phẩm không trục mà gửi tuỳ chọn → 400 VARIANT_OPTIONS_INVALID", async () => {
    const [color] = (await getProductAttributes(PRODUCT)).axes;
    const onlyColor = [color?.options[0]?.valueId ?? ""];
    const missing = await apiError(
      addVariant({ productId: PRODUCT, sku: "", name: "", optionValueIds: onlyColor }),
    );
    expect(missing.code).toBe("VARIANT_OPTIONS_INVALID");
    expect(variantErrorMessage(missing, "save")).toMatch(/đúng một giá trị/);

    const noAxes = await apiError(
      addVariant({
        productId: NO_AXES_PRODUCT,
        sku: "NOAXES-1",
        name: "x",
        optionValueIds: onlyColor,
      }),
    );
    expect(noAxes.code).toBe("VARIANT_OPTIONS_INVALID");
  });
});

// BE PR #119: logistics của SKU không còn dưới sản phẩm — nằm ở hồ sơ hàng tồn của biến thể.
describe("hồ sơ hàng tồn của biến thể (BE PR #119)", () => {
  it("biến thể mang inventoryItemId, tra được ở /inventory/items/{id} cùng SKU", async () => {
    const variants = await listVariants(PRODUCT);
    expect(variants.every((v) => typeof v.inventoryItemId === "string")).toBe(true);
    const [v] = variants;
    if (!v?.inventoryItemId) throw new Error("variant has no inventory item");
    const item = await fetchInventoryItemSummary(v.inventoryItemId);
    expect(item).toMatchObject({ id: v.inventoryItemId, sku: v.sku });
    expect(item.logistics.unitOfMeasure).toBeTruthy();
  });

  it("biến thể vừa thêm cũng có hồ sơ (BE tạo item cùng biến thể)", async () => {
    const created = await addVariant({
      productId: NO_AXES_PRODUCT,
      sku: "NOAXES-ITEM",
      name: "Có hồ sơ",
      optionValueIds: [],
    });
    expect(created.inventoryItemId).toBeTruthy();
    const item = await fetchInventoryItemSummary(created.inventoryItemId ?? "");
    expect(item.sku).toBe("NOAXES-ITEM");
    const activated = await transitionVariant({
      productId: NO_AXES_PRODUCT,
      variantId: created.variantId,
      action: "activate",
    });
    expect(activated.inventoryItemId).toBe(created.inventoryItemId);
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
