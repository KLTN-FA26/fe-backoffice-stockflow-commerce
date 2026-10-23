/**
 * Contract test: mock adapter nói đúng hợp đồng BE PR #114 / #115 / #116 (trục, thuộc tính mô tả, sinh
 * ma trận, tạo sản phẩm kèm trục) để `axes-api.ts` / `api.ts` (parse zod) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { api as http } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductHistoryMock } from "@/lib/api/mock-product-history";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { createProduct, getProduct, listBrands, listCategories, transitionProduct } from "./api";
import {
  addAttributeValue,
  createAttribute,
  updateAttribute,
  updateAttributeValue,
} from "./attribute-api";
import {
  generateVariants,
  getProductAttributes,
  replaceProductAxes,
  replaceProductDescriptives,
} from "./axes-api";
import { listProductVersions } from "./lifecycle-api";
import { addVariant, listVariants } from "./variant-api";

import type { Attribute, AttributeDataType } from "./attribute-schemas";
import type { AxisInput } from "./axes-schemas";

// Mỗi request mock có độ trễ ~215 ms (adapter) nên các luồng nhiều bước cần giới hạn rộng hơn mặc định.
vi.setConfig({ testTimeout: 60_000 });

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetProductHistoryMock();
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

let n = 0;
const uid = () => `${Date.now()}${(n += 1)}`;

/** Thuộc tính thử với các giá trị cho trước (màu cần mã màu). */
async function dictionary(dataType: AttributeDataType, codes: string[]): Promise<Attribute> {
  let attribute = await createAttribute({
    code: `AX${uid()}`,
    dataType,
    name: `Thuộc tính ${dataType}`,
    unit: "",
    filterable: true,
    searchable: false,
    sortOrder: "",
    active: true,
  });
  for (const [index, code] of codes.entries()) {
    attribute = await addAttributeValue({
      attributeId: attribute.attributeId,
      values: {
        code,
        label: `Nhãn ${code}`,
        valueNumber: "",
        hexColor: dataType === "COLOR" ? `#${String(10 + index).repeat(3)}` : "",
        sortOrder: String(index),
        active: true,
      },
    });
  }
  return attribute;
}
const ids = (attribute: Attribute, ...codes: string[]) =>
  codes.map((code) => attribute.values.find((v) => v.code === code)?.valueId ?? "");

async function baseInput(axes?: AxisInput[], code = `AXP-${uid()}`) {
  const [category] = (await listCategories()).items;
  const [brand] = await listBrands();
  return {
    code,
    name: "Sản phẩm trục",
    nameEn: "Axes product",
    categoryId: category?.categoryId ?? "",
    brandId: brand?.brandId ?? "",
    description: "",
    descriptionEn: "",
    taxClass: "STANDARD" as const,
    kind: "STANDARD" as const,
    ...(axes ? { axes } : {}),
  };
}
const axis = (attribute: Attribute, ...codes: string[]): AxisInput => ({
  attributeId: attribute.attributeId,
  optionValueIds: ids(attribute, ...codes),
});

async function approve(productId: string) {
  await transitionProduct({ id: productId, action: "submit" });
  return transitionProduct({ id: productId, action: "approve" });
}

describe("tạo sản phẩm (BE PR #116 CreateProductRequest.axes)", () => {
  it("không trục: một biến thể mặc định Nháp, SKU = mã sản phẩm, tên = tên sản phẩm; chưa có trục", async () => {
    const product = await createProduct(await baseInput());
    const variants = await listVariants(product.productId);
    expect(variants).toHaveLength(1);
    expect(variants[0]).toMatchObject({
      sku: product.productId,
      name: "Sản phẩm trục",
      status: "DRAFT",
      defaultVariant: true,
      options: [],
    });
    expect(await getProductAttributes(product.productId)).toEqual({
      productId: product.productId,
      axes: [],
      descriptives: [],
    });
  });

  it("có trục: tạo đủ ma trận, SKU MÃ-GIÁ_TRỊ-… theo thứ tự trục, tổ hợp đầu là biến thể mặc định", async () => {
    const a = await dictionary("SELECT", ["X1", "X2"]);
    const b = await dictionary("COLOR", ["R", "G"]);
    const code = `MX-${uid()}`;
    const product = await createProduct(
      await baseInput([axis(a, "X2", "X1"), axis(b, "R", "G")], code),
    );
    const variants = await listVariants(product.productId);
    expect(variants.map((v) => v.sku)).toEqual([
      `${code}-X1-R`,
      `${code}-X1-G`,
      `${code}-X2-R`,
      `${code}-X2-G`,
    ]);
    expect(variants.map((v) => v.defaultVariant)).toEqual([true, false, false, false]);
    expect(variants.every((v) => v.status === "DRAFT")).toBe(true);
    expect(variants[0]?.name).toBe("Sản phẩm trục – Nhãn X1 / Nhãn R");
    expect(variants[0]?.options.map((o) => o.valueCode)).toEqual(["X1", "R"]);

    const attributes = await getProductAttributes(product.productId);
    expect(attributes.axes.map((x) => x.code)).toEqual([a.code, b.code]);
    expect(attributes.axes[0]?.options.map((o) => o.code)).toEqual(["X1", "X2"]);
    expect(attributes.axes.every((x) => x.options.every((o) => o.usedByVariant))).toBe(true);
  });

  it("bị từ chối thì không để lại sản phẩm: SKU trùng, SKU quá dài, trục không hợp lệ", async () => {
    const a = await dictionary("SELECT", ["X1"]);
    // SKU sinh ra trùng SKU của một sản phẩm khác (mặc định SKU = mã).
    const stem = `CL-${uid()}`;
    await createProduct(await baseInput(undefined, `${stem}-X1`));
    const taken = await apiError(createProduct(await baseInput([axis(a, "X1")], stem)));
    expect(taken.code).toBe("VARIANT_SKU_ALREADY_EXISTS");
    expect((await apiError(getProduct(stem))).status).toBe(404);
    expect(await listVariants(stem)).toEqual([]);

    // 62 ký tự + "-X1" = 65 > 64.
    const longCode = "L".repeat(62);
    const tooLong = await apiError(createProduct(await baseInput([axis(a, "X1")], longCode)));
    expect(tooLong.code).toBe("VALIDATION_FAILED");
    expect((await apiError(getProduct(longCode))).status).toBe(404);

    const text = await dictionary("TEXT", []);
    const notAxis = await apiError(
      createProduct(await baseInput([{ attributeId: text.attributeId, optionValueIds: ["x"] }])),
    );
    expect(notAxis.code).toBe("VALIDATION_FAILED");
    const unknown = await apiError(
      createProduct(await baseInput([{ attributeId: "không-có", optionValueIds: ["x"] }])),
    );
    expect(unknown.code).toBe("ATTRIBUTE_NOT_FOUND");
    const badValue = await apiError(
      createProduct(
        await baseInput([{ attributeId: a.attributeId, optionValueIds: ["không-có"] }]),
      ),
    );
    expect(badValue.code).toBe("VALIDATION_FAILED");
    const twice = await apiError(createProduct(await baseInput([axis(a, "X1"), axis(a, "X1")])));
    expect(twice.code).toBe("VALIDATION_FAILED");
  });

  it("quá 100 tổ hợp → 400 VARIANT_MATRIX_TOO_LARGE và không tạo sản phẩm", async () => {
    const big = await dictionary(
      "SELECT",
      Array.from({ length: 11 }, (_, i) => `B${i}`),
    );
    const ten = await dictionary(
      "SELECT",
      Array.from({ length: 10 }, (_, i) => `T${i}`),
    );
    const code = `BIG-${uid()}`;
    const rejected = await apiError(
      createProduct(
        await baseInput(
          [
            axis(big, ...big.values.map((v) => v.code)),
            axis(ten, ...ten.values.map((v) => v.code)),
          ],
          code,
        ),
      ),
    );
    expect(rejected.code).toBe("VARIANT_MATRIX_TOO_LARGE");
    expect((await apiError(getProduct(code))).status).toBe(404);
    // Đúng 100 tổ hợp (10 × 10) thì được.
    const exact = await createProduct(
      await baseInput([
        axis(big, ...big.values.slice(0, 10).map((v) => v.code)),
        axis(ten, ...ten.values.map((v) => v.code)),
      ]),
    );
    expect(await listVariants(exact.productId)).toHaveLength(100);
  }, 60_000);
});

describe("sinh ma trận (BE PR #115)", () => {
  it("idempotent: thêm giá trị rồi sinh chỉ tạo tổ hợp mới; tổ hợp đã có được đếm skipped", async () => {
    const a = await dictionary("SELECT", ["X1", "X2", "X3"]);
    const b = await dictionary("SELECT", ["R", "G"]);
    const code = `GEN-${uid()}`;
    const product = await createProduct(
      await baseInput([axis(a, "X1", "X2"), axis(b, "R", "G")], code),
    );
    expect(await listVariants(product.productId)).toHaveLength(4);

    const none = await generateVariants({ productId: product.productId });
    expect(none).toEqual({ created: [], skipped: 4 });

    await replaceProductAxes({
      productId: product.productId,
      axes: [axis(a, "X1", "X2", "X3"), axis(b, "R", "G")],
    });
    const result = await generateVariants({ productId: product.productId });
    expect(result.skipped).toBe(4);
    expect(result.created.map((v) => v.sku)).toEqual([`${code}-X3-R`, `${code}-X3-G`]);
    expect(result.created.every((v) => v.status === "DRAFT" && !v.defaultVariant)).toBe(true);
    expect(result.created[0]?.name).toBe("Sản phẩm trục – Nhãn X3 / Nhãn R");
    expect(await listVariants(product.productId)).toHaveLength(6);
    expect(await generateVariants({ productId: product.productId })).toEqual({
      created: [],
      skipped: 6,
    });
  });

  it("hạn chế theo trục: chỉ sinh tổ hợp chứa giá trị được chọn", async () => {
    const a = await dictionary("SELECT", ["X1", "X2", "X3"]);
    const b = await dictionary("SELECT", ["R", "G"]);
    const product = await createProduct(await baseInput([axis(a, "X1"), axis(b, "R")]));
    await replaceProductAxes({
      productId: product.productId,
      axes: [axis(a, "X1", "X2", "X3"), axis(b, "R", "G")],
    });
    const result = await generateVariants({
      productId: product.productId,
      optionValueIds: { [a.attributeId]: ids(a, "X2") },
    });
    expect(result.created.map((v) => v.options.map((o) => o.valueCode))).toEqual([
      ["X2", "R"],
      ["X2", "G"],
    ]);
    expect(await listVariants(product.productId)).toHaveLength(3);
  });

  it("biến thể mặc định chưa gán nhận tổ hợp đầu tiên và giữ SKU = mã sản phẩm", async () => {
    const a = await dictionary("SELECT", ["X1", "X2"]);
    const product = await createProduct(await baseInput());
    await replaceProductAxes({ productId: product.productId, axes: [axis(a, "X1", "X2")] });
    const result = await generateVariants({ productId: product.productId });
    expect(result.created).toHaveLength(1);
    expect(result.skipped).toBe(0);
    const variants = await listVariants(product.productId);
    const defaultVariant = variants.find((v) => v.defaultVariant);
    expect(defaultVariant).toMatchObject({ sku: product.productId });
    expect(defaultVariant?.options.map((o) => o.valueCode)).toEqual(["X1"]);
    expect(variants).toHaveLength(2);
  });

  it("lỗi: sản phẩm chưa có trục, trục lạ, giá trị đã vô hiệu, trục rỗng → 400 VARIANT_OPTIONS_INVALID", async () => {
    const none = await createProduct(await baseInput());
    expect((await apiError(generateVariants({ productId: none.productId }))).code).toBe(
      "VARIANT_OPTIONS_INVALID",
    );

    const a = await dictionary("SELECT", ["X1", "X2"]);
    const product = await createProduct(await baseInput([axis(a, "X1", "X2")]));
    const stranger = await apiError(
      generateVariants({ productId: product.productId, optionValueIds: { "không-có": ["x"] } }),
    );
    expect(stranger.code).toBe("VARIANT_OPTIONS_INVALID");
    const empty = await apiError(
      generateVariants({ productId: product.productId, optionValueIds: { [a.attributeId]: [] } }),
    );
    expect(empty.code).toBe("VARIANT_OPTIONS_INVALID");

    // Vô hiệu một giá trị trong từ điển: sinh bỏ qua nó; nêu đích danh nó là lỗi.
    const x2 = a.values.find((v) => v.code === "X2");
    if (!x2) throw new Error("missing value");
    await updateAttributeValue({
      attributeId: a.attributeId,
      valueId: x2.valueId,
      version: x2.version,
      values: {
        code: "X2",
        label: x2.label,
        valueNumber: "",
        hexColor: "",
        sortOrder: "1",
        active: false,
      },
    });
    const named = await apiError(
      generateVariants({
        productId: product.productId,
        optionValueIds: { [a.attributeId]: [x2.valueId] },
      }),
    );
    expect(named.code).toBe("VARIANT_OPTIONS_INVALID");
    // BE tính trên giá trị đang dùng: chỉ còn tổ hợp X1 (đã có) nên skipped = 1.
    expect(await generateVariants({ productId: product.productId })).toEqual({
      created: [],
      skipped: 1,
    });
  });

  it("sản phẩm chờ duyệt không nhận thay đổi → 409 INVALID_PRODUCT_STATUS_TRANSITION", async () => {
    const a = await dictionary("SELECT", ["X1"]);
    const product = await createProduct(await baseInput([axis(a, "X1")]));
    await transitionProduct({ id: product.productId, action: "submit" });
    expect((await apiError(generateVariants({ productId: product.productId }))).code).toBe(
      "INVALID_PRODUCT_STATUS_TRANSITION",
    );
  });
});

describe("trục của sản phẩm (BE PR #114 PUT /axes)", () => {
  it("Nháp: thêm / gỡ trục được cho tới khi có biến thể mang tuỳ chọn; sau đó thêm trục → 409 PRODUCT_AXES_LOCKED", async () => {
    const a = await dictionary("SELECT", ["X1", "X2"]);
    const b = await dictionary("SELECT", ["R"]);
    const product = await createProduct(await baseInput());
    const withA = await replaceProductAxes({
      productId: product.productId,
      axes: [axis(a, "X1", "X2")],
    });
    expect(withA.axes[0]).toMatchObject({ code: a.code, sortOrder: 0 });
    // Chưa biến thể nào mang tuỳ chọn → gỡ trục vẫn được.
    expect((await replaceProductAxes({ productId: product.productId, axes: [] })).axes).toEqual([]);
    await replaceProductAxes({ productId: product.productId, axes: [axis(a, "X1", "X2")] });
    await generateVariants({ productId: product.productId });
    const locked = await apiError(
      replaceProductAxes({
        productId: product.productId,
        axes: [axis(a, "X1", "X2"), axis(b, "R")],
      }),
    );
    expect(locked.code).toBe("PRODUCT_AXES_LOCKED");
    // Vẫn thêm giá trị cho trục đã có.
    const more = await dictionary("SELECT", []);
    expect(more.values).toEqual([]);
  });

  it("đã duyệt: không thêm / gỡ trục (PRODUCT_AXES_LOCKED), thêm giá trị được, gỡ giá trị đang được biến thể dùng → ATTRIBUTE_IN_USE", async () => {
    const a = await dictionary("SELECT", ["X1", "X2", "X3"]);
    const b = await dictionary("SELECT", ["R"]);
    const product = await createProduct(await baseInput([axis(a, "X1", "X2")]));
    await approve(product.productId);

    const addAxis = await apiError(
      replaceProductAxes({
        productId: product.productId,
        axes: [axis(a, "X1", "X2"), axis(b, "R")],
      }),
    );
    expect(addAxis.code).toBe("PRODUCT_AXES_LOCKED");
    const removeAxis = await apiError(
      replaceProductAxes({ productId: product.productId, axes: [] }),
    );
    expect(removeAxis.code).toBe("PRODUCT_AXES_LOCKED");

    const grown = await replaceProductAxes({
      productId: product.productId,
      axes: [axis(a, "X1", "X2", "X3")],
    });
    expect(grown.axes[0]?.options.map((o) => [o.code, o.usedByVariant])).toEqual([
      ["X1", true],
      ["X2", true],
      ["X3", false],
    ]);
    const dropUsed = await apiError(
      replaceProductAxes({ productId: product.productId, axes: [axis(a, "X1", "X3")] }),
    );
    expect(dropUsed.code).toBe("ATTRIBUTE_IN_USE");
    const dropUnused = await replaceProductAxes({
      productId: product.productId,
      axes: [axis(a, "X1", "X2")],
    });
    expect(dropUnused.axes[0]?.options.map((o) => o.code)).toEqual(["X1", "X2"]);
  });

  it("chờ duyệt / đã ngừng kinh doanh → 409 INVALID_PRODUCT_STATUS_TRANSITION", async () => {
    const a = await dictionary("SELECT", ["X1"]);
    const product = await createProduct(await baseInput([axis(a, "X1")]));
    await transitionProduct({ id: product.productId, action: "submit" });
    const refused = await apiError(
      replaceProductAxes({ productId: product.productId, axes: [axis(a, "X1")] }),
    );
    expect(refused.code).toBe("INVALID_PRODUCT_STATUS_TRANSITION");
  });

  it("luật dữ liệu: loại không làm trục được, thuộc tính lạ, thuộc tính ngừng dùng, giá trị lạ, giá trị đã vô hiệu", async () => {
    const product = await createProduct(await baseInput());
    const text = await dictionary("TEXT", []);
    const multi = await dictionary("MULTISELECT", ["M1"]);
    const a = await dictionary("SELECT", ["X1", "X2"]);
    const put = (axes: AxisInput[]) => replaceProductAxes({ productId: product.productId, axes });
    expect(
      (await apiError(put([{ attributeId: text.attributeId, optionValueIds: ["x"] }]))).code,
    ).toBe("VALIDATION_FAILED");
    expect((await apiError(put([axis(multi, "M1")]))).code).toBe("VALIDATION_FAILED");
    expect((await apiError(put([{ attributeId: "không-có", optionValueIds: ["x"] }]))).code).toBe(
      "ATTRIBUTE_NOT_FOUND",
    );
    expect(
      (await apiError(put([{ attributeId: a.attributeId, optionValueIds: ["không-có"] }]))).code,
    ).toBe("VALIDATION_FAILED");

    await updateAttribute({
      attributeId: a.attributeId,
      version: a.version,
      values: {
        code: a.code,
        dataType: "SELECT",
        name: a.name,
        unit: "",
        filterable: true,
        searchable: false,
        sortOrder: "",
        active: false,
      },
    });
    expect((await apiError(put([axis(a, "X1")]))).code).toBe("VALIDATION_FAILED");
  });

  it("FE chặn trục trùng; BE chặn trục không có giá trị (400) nếu bỏ qua FE", async () => {
    const a = await dictionary("SELECT", ["X1"]);
    const product = await createProduct(await baseInput());
    await expect(
      replaceProductAxes({ productId: product.productId, axes: [axis(a, "X1"), axis(a, "X1")] }),
    ).rejects.toThrow();
    const raw = await apiError(
      http.put(`/products/${product.productId}/axes`, {
        axes: [{ attributeId: a.attributeId, optionValueIds: [] }],
      }),
    );
    expect(raw.code).toBe("VALIDATION_FAILED");
  });

  it("ghi lịch sử UPDATED [axes] chỉ khi bộ trục thật sự đổi", async () => {
    const a = await dictionary("SELECT", ["X1", "X2"]);
    const product = await createProduct(await baseInput());
    await replaceProductAxes({ productId: product.productId, axes: [axis(a, "X1")] });
    await replaceProductAxes({ productId: product.productId, axes: [axis(a, "X1")] });
    const history = await listProductVersions(product.productId);
    expect(history.items.filter((e) => e.changedFields?.includes("axes"))).toHaveLength(1);
  });
});

describe("thuộc tính mô tả (BE PR #114 PUT /descriptive-attributes)", () => {
  it("lưu từng loại: văn bản, số (kèm đơn vị), đúng / sai, một lựa chọn, nhiều lựa chọn; đọc lại đúng thứ tự", async () => {
    const product = await createProduct(await baseInput());
    const text = await dictionary("TEXT", []);
    const num = await dictionary("NUMBER", []);
    const flag = await dictionary("BOOLEAN", []);
    const one = await dictionary("SELECT", ["P", "Q"]);
    const many = await dictionary("MULTISELECT", ["M1", "M2", "M3"]);
    const saved = await replaceProductDescriptives({
      productId: product.productId,
      attributes: [
        { attributeId: text.attributeId, sortOrder: 0, text: "Cotton" },
        { attributeId: num.attributeId, sortOrder: 1, number: 12.5 },
        { attributeId: flag.attributeId, sortOrder: 2, bool: false },
        { attributeId: one.attributeId, sortOrder: 3, valueIds: ids(one, "Q") },
        { attributeId: many.attributeId, sortOrder: 4, valueIds: ids(many, "M1", "M3") },
      ],
    });
    expect(saved.descriptives).toHaveLength(5);
    expect(saved.descriptives[0]).toMatchObject({ code: text.code, text: "Cotton" });
    expect(saved.descriptives[1]).toMatchObject({ number: 12.5 });
    expect(saved.descriptives[2]).toMatchObject({ bool: false });
    expect(saved.descriptives[3]?.values.map((v) => v.code)).toEqual(["Q"]);
    expect(saved.descriptives[4]?.values.map((v) => v.code)).toEqual(["M1", "M3"]);
    expect((await getProductAttributes(product.productId)).descriptives).toHaveLength(5);

    // Cả danh sách thay thế toàn bộ; rỗng xoá hết.
    const smaller = await replaceProductDescriptives({
      productId: product.productId,
      attributes: [{ attributeId: text.attributeId, text: "Lanh" }],
    });
    expect(smaller.descriptives.map((d) => d.text)).toEqual(["Lanh"]);
    expect(
      (await replaceProductDescriptives({ productId: product.productId, attributes: [] }))
        .descriptives,
    ).toEqual([]);
  });

  it("sai kiểu giá trị → 400; một thuộc tính không vừa là trục vừa là mô tả; thuộc tính ngừng dùng không thêm mới", async () => {
    const a = await dictionary("SELECT", ["X1"]);
    const text = await dictionary("TEXT", []);
    const product = await createProduct(await baseInput([axis(a, "X1")]));
    const put = (attributes: Record<string, unknown>[]) =>
      http.put(`/products/${product.productId}/descriptive-attributes`, { attributes });
    expect((await apiError(put([{ attributeId: text.attributeId, valueIds: ["x"] }]))).code).toBe(
      "VALIDATION_FAILED",
    );
    expect((await apiError(put([{ attributeId: text.attributeId, text: "   " }]))).code).toBe(
      "VALIDATION_FAILED",
    );
    expect(
      (await apiError(put([{ attributeId: a.attributeId, valueIds: ids(a, "X1") }]))).code,
    ).toBe("VALIDATION_FAILED");
    expect(
      (
        await apiError(
          put([
            { attributeId: text.attributeId, text: "a" },
            { attributeId: text.attributeId, text: "b" },
          ]),
        )
      ).code,
    ).toBe("VALIDATION_FAILED");
    expect((await apiError(put([{ attributeId: "không-có", text: "a" }]))).code).toBe(
      "ATTRIBUTE_NOT_FOUND",
    );
    // Trục lại không chọn được thuộc tính đang là mô tả.
    await replaceProductDescriptives({
      productId: product.productId,
      attributes: [{ attributeId: text.attributeId, text: "ok" }],
    });
    expect(
      (
        await apiError(
          replaceProductAxes({
            productId: product.productId,
            axes: [axis(a, "X1")].concat([
              { attributeId: text.attributeId, optionValueIds: ["x"] },
            ]),
          }),
        )
      ).code,
    ).toBe("VALIDATION_FAILED");
  });

  it("sản phẩm đã duyệt vẫn sửa được thuộc tính mô tả (BE: chỉ chờ duyệt / ngừng kinh doanh bị chặn)", async () => {
    const text = await dictionary("TEXT", []);
    const product = await createProduct(await baseInput());
    await approve(product.productId);
    const saved = await replaceProductDescriptives({
      productId: product.productId,
      attributes: [{ attributeId: text.attributeId, text: "Mô tả" }],
    });
    expect(saved.descriptives).toHaveLength(1);
    const history = await listProductVersions(product.productId);
    expect(history.items[0]).toMatchObject({
      changeType: "UPDATED",
      changedFields: ["descriptiveAttributes"],
    });
  });

  it("thêm biến thể tay vào sản phẩm có trục vẫn dùng tuỳ chọn trong trục (không phải giá trị tuỳ ý)", async () => {
    const a = await dictionary("SELECT", ["X1", "X2"]);
    const product = await createProduct(await baseInput([axis(a, "X1")]));
    await replaceProductAxes({ productId: product.productId, axes: [axis(a, "X1", "X2")] });
    const added = await addVariant({
      productId: product.productId,
      sku: "",
      name: "",
      optionValueIds: ids(a, "X2"),
    });
    expect(added.sku).toBe(`${product.productId}-X2`);
    const outside = await dictionary("SELECT", ["Z1"]);
    expect(
      (
        await apiError(
          addVariant({
            productId: product.productId,
            sku: "",
            name: "",
            optionValueIds: ids(outside, "Z1"),
          }),
        )
      ).code,
    ).toBe("VARIANT_OPTIONS_INVALID");
  });
});
