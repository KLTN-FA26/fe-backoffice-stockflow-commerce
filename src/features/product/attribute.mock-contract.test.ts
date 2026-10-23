/**
 * Contract test: mock adapter nói đúng hợp đồng BE PR #113 (từ điển thuộc tính, giá trị, bộ thuộc tính
 * danh mục) để `attribute-api.ts` (parse zod) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import {
  addAttributeValue,
  createAttribute,
  deleteAttribute,
  deleteAttributeValue,
  getAttribute,
  listAttributes,
  listCategoryAttributes,
  replaceCategoryAttributes,
  updateAttribute,
  updateAttributeValue,
} from "./attribute-api";
import { listCategories } from "./api";

import type { AttributeFormValues, AttributeValueFormValues } from "./attribute-schemas";

vi.setConfig({ testTimeout: 60_000 });

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
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

let n = 0;
const attributeForm = (over: Partial<AttributeFormValues> = {}): AttributeFormValues => {
  n += 1;
  return {
    code: `t${Date.now()}_${n}`,
    dataType: "SELECT",
    name: "Thuộc tính thử",
    unit: "",
    filterable: true,
    searchable: false,
    sortOrder: "",
    active: true,
    ...over,
  };
};
const valueForm = (over: Partial<AttributeValueFormValues> = {}): AttributeValueFormValues => {
  n += 1;
  return {
    code: `v${n}`,
    label: "Giá trị thử",
    valueNumber: "",
    hexColor: "",
    sortOrder: "",
    active: true,
    ...over,
  };
};

describe("danh sách + lọc (BE GET /attributes)", () => {
  it("có màu và cỡ từ dữ liệu mẫu; giá trị màu luôn có #RRGGBB, sắp theo thứ tự từ điển", async () => {
    const page = await listAttributes();
    const color = page.items.find((a) => a.attributeId === "ATTR-COLOR");
    const size = page.items.find((a) => a.attributeId === "ATTR-SIZE");
    expect(color).toMatchObject({ code: "COLOR", dataType: "COLOR", active: true });
    expect(size).toMatchObject({ code: "SIZE", dataType: "SELECT" });
    expect(color?.values.length).toBeGreaterThan(1);
    for (const value of color?.values ?? []) expect(value.hexColor).toMatch(/^#[0-9A-F]{6}$/);
    for (const value of size?.values ?? []) expect(value.hexColor ?? null).toBeNull();
    const orders = (color?.values ?? []).map((v) => v.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(page.page).toBe(0);
  });

  it("lọc theo q (mã hoặc tên, không phân biệt hoa thường), dataType và active", async () => {
    expect((await listAttributes({ q: "color" })).items.map((a) => a.code)).toContain("COLOR");
    expect(
      (await listAttributes({ dataType: "COLOR" })).items.every((a) => a.dataType === "COLOR"),
    ).toBe(true);
    const created = await createAttribute(attributeForm({ code: "inactive_probe" }));
    await updateAttribute({
      attributeId: created.attributeId,
      version: created.version,
      values: { ...attributeForm({ code: created.code }), active: false },
    });
    const inactive = await listAttributes({ active: false });
    expect(inactive.items.some((a) => a.attributeId === created.attributeId)).toBe(true);
    expect(
      (await listAttributes({ active: true })).items.some(
        (a) => a.attributeId === created.attributeId,
      ),
    ).toBe(false);
  });

  it("thuộc tính không tồn tại → 404 ATTRIBUTE_NOT_FOUND", async () => {
    expect((await apiError(getAttribute("không-có"))).code).toBe("ATTRIBUTE_NOT_FOUND");
  });
});

describe("tạo / sửa / xoá thuộc tính", () => {
  it("tạo viết hoa mã, bắt đầu active ở version 0; mã trùng → 409 ATTRIBUTE_CODE_ALREADY_EXISTS", async () => {
    const created = await createAttribute(
      attributeForm({ code: "mixed_Case", unit: "cm", sortOrder: "7" }),
    );
    expect(created).toMatchObject({
      code: "MIXED_CASE",
      active: true,
      version: 0,
      unit: "cm",
      sortOrder: 7,
      values: [],
    });
    const duplicate = await apiError(createAttribute(attributeForm({ code: "MIXED_case" })));
    expect(duplicate.code).toBe("ATTRIBUTE_CODE_ALREADY_EXISTS");
    expect(duplicate.status).toBe(409);
  });

  it("mã không đúng mẫu BE → 400 VALIDATION_FAILED", async () => {
    expect((await apiError(createAttribute(attributeForm({ code: "bad-code" })))).code).toBe(
      "VALIDATION_FAILED",
    );
  });

  it("sửa: tăng version, giữ mã và loại; version cũ → 409 OPTIMISTIC_LOCK", async () => {
    const created = await createAttribute(attributeForm());
    const updated = await updateAttribute({
      attributeId: created.attributeId,
      version: created.version,
      values: { ...attributeForm({ code: created.code }), name: "Tên mới", filterable: false },
    });
    expect(updated).toMatchObject({
      code: created.code,
      dataType: "SELECT",
      name: "Tên mới",
      filterable: false,
      version: 1,
    });
    const stale = await apiError(
      updateAttribute({
        attributeId: created.attributeId,
        version: created.version,
        values: attributeForm(),
      }),
    );
    expect(stale.code).toBe("OPTIMISTIC_LOCK");
  });

  it("xoá cần version đúng; đang được sản phẩm dùng → 409 ATTRIBUTE_IN_USE; xoá xong thì 404", async () => {
    const created = await createAttribute(attributeForm());
    expect(
      (await apiError(deleteAttribute({ attributeId: created.attributeId, version: 9 }))).code,
    ).toBe("OPTIMISTIC_LOCK");
    expect((await apiError(deleteAttribute({ attributeId: "ATTR-COLOR", version: 0 }))).code).toBe(
      "ATTRIBUTE_IN_USE",
    );
    await expect(
      deleteAttribute({ attributeId: created.attributeId, version: created.version }),
    ).resolves.toBeUndefined();
    expect((await apiError(getAttribute(created.attributeId))).code).toBe("ATTRIBUTE_NOT_FOUND");
  });
});

describe("giá trị của thuộc tính", () => {
  it("SELECT: thêm giá trị viết hoa mã, active ở version 0; không được có màu; mã trùng → 409", async () => {
    const attribute = await createAttribute(attributeForm());
    const withValue = await addAttributeValue({
      attributeId: attribute.attributeId,
      values: valueForm({ code: "12oz-hot", label: "12oz nóng", sortOrder: "2" }),
    });
    expect(withValue.values).toHaveLength(1);
    expect(withValue.values[0]).toMatchObject({
      code: "12OZ-HOT",
      label: "12oz nóng",
      active: true,
      version: 0,
      sortOrder: 2,
    });
    expect(
      (
        await apiError(
          addAttributeValue({
            attributeId: attribute.attributeId,
            values: valueForm({ code: "12OZ-HOT" }),
          }),
        )
      ).code,
    ).toBe("ATTRIBUTE_CODE_ALREADY_EXISTS");
    const colour = await apiError(
      addAttributeValue({
        attributeId: attribute.attributeId,
        values: valueForm({ hexColor: "#FF0000" }),
      }),
    );
    expect(colour.code).toBe("VALIDATION_FAILED");
  });

  it("COLOR: cần #RRGGBB (đổi sang chữ hoa); thiếu màu hoặc màu sai → 400", async () => {
    const attribute = await createAttribute(attributeForm({ dataType: "COLOR" }));
    const added = await addAttributeValue({
      attributeId: attribute.attributeId,
      values: valueForm({ hexColor: "#ff8800" }),
    });
    expect(added.values[0]?.hexColor).toBe("#FF8800");
    expect(
      (
        await apiError(
          addAttributeValue({ attributeId: attribute.attributeId, values: valueForm() }),
        )
      ).code,
    ).toBe("VALIDATION_FAILED");
    expect(
      (
        await apiError(
          addAttributeValue({
            attributeId: attribute.attributeId,
            values: valueForm({ hexColor: "orange" }),
          }),
        )
      ).code,
    ).toBe("VALIDATION_FAILED");
  });

  it("thuộc tính TEXT / NUMBER / BOOLEAN không có danh sách giá trị → 400", async () => {
    for (const dataType of ["TEXT", "NUMBER", "BOOLEAN"] as const) {
      const attribute = await createAttribute(attributeForm({ dataType }));
      expect(
        (
          await apiError(
            addAttributeValue({ attributeId: attribute.attributeId, values: valueForm() }),
          )
        ).code,
      ).toBe("VALIDATION_FAILED");
    }
  });

  it("sửa giá trị gửi version của giá trị; vô hiệu hoá; version cũ → 409 OPTIMISTIC_LOCK", async () => {
    const attribute = await createAttribute(attributeForm());
    const added = await addAttributeValue({
      attributeId: attribute.attributeId,
      values: valueForm({ code: "A1" }),
    });
    const value = added.values[0];
    if (!value) throw new Error("value missing");
    const updated = await updateAttributeValue({
      attributeId: attribute.attributeId,
      valueId: value.valueId,
      version: value.version,
      values: valueForm({ code: "A1", label: "Nhãn mới", active: false }),
    });
    expect(updated.values[0]).toMatchObject({ label: "Nhãn mới", active: false, version: 1 });
    const stale = await apiError(
      updateAttributeValue({
        attributeId: attribute.attributeId,
        valueId: value.valueId,
        version: 0,
        values: valueForm({ code: "A1" }),
      }),
    );
    expect(stale.code).toBe("OPTIMISTIC_LOCK");
    expect(
      (
        await apiError(
          updateAttributeValue({
            attributeId: attribute.attributeId,
            valueId: "không-có",
            version: 0,
            values: valueForm(),
          }),
        )
      ).code,
    ).toBe("ATTRIBUTE_VALUE_NOT_FOUND");
  });

  it("xoá giá trị trả thuộc tính không còn giá trị đó; giá trị đang được sản phẩm dùng → 409 ATTRIBUTE_IN_USE", async () => {
    const attribute = await createAttribute(attributeForm());
    const added = await addAttributeValue({
      attributeId: attribute.attributeId,
      values: valueForm({ code: "TMP" }),
    });
    const value = added.values[0];
    if (!value) throw new Error("value missing");
    const after = await deleteAttributeValue({
      attributeId: attribute.attributeId,
      valueId: value.valueId,
      version: value.version,
    });
    expect(after.values).toEqual([]);

    const size = await getAttribute("ATTR-SIZE");
    // "L" có SKU mẫu mang nó (cỡ trục của sản phẩm); "S" thì chưa SKU nào dùng.
    const used = size.values.find((v) => v.code === "L");
    if (!used) throw new Error("seed value missing");
    const inUse = await apiError(
      deleteAttributeValue({
        attributeId: "ATTR-SIZE",
        valueId: used.valueId,
        version: used.version,
      }),
    );
    expect(inUse.code).toBe("ATTRIBUTE_IN_USE");
  });
});

describe("bộ thuộc tính theo danh mục (BE /categories/{id}/attributes)", () => {
  async function category(index = 0) {
    const item = (await listCategories()).items[index];
    if (!item) throw new Error("no category");
    return item.categoryId;
  }

  it("danh mục chưa có bộ → rỗng; không tồn tại → 404 CATEGORY_NOT_FOUND", async () => {
    expect(await listCategoryAttributes(await category(1))).toEqual([]);
    expect((await apiError(listCategoryAttributes("không-có"))).code).toBe("CATEGORY_NOT_FOUND");
  });

  it("PUT thay cả bộ, trả theo thứ tự; bỏ thuộc tính ra là gỡ; danh sách rỗng xoá hết", async () => {
    const categoryId = await category(2);
    const saved = await replaceCategoryAttributes({
      categoryId,
      attributes: [
        { attributeId: "ATTR-SIZE", defaultRole: "VARIANT_AXIS", required: true, sortOrder: 1 },
        { attributeId: "ATTR-COLOR", defaultRole: "VARIANT_AXIS", required: false, sortOrder: 0 },
      ],
    });
    expect(saved.map((a) => a.attributeCode)).toEqual(["COLOR", "SIZE"]);
    expect(saved[1]).toMatchObject({ required: true, dataType: "SELECT", attributeActive: true });
    const replaced = await replaceCategoryAttributes({
      categoryId,
      attributes: [
        { attributeId: "ATTR-SIZE", defaultRole: "DESCRIPTIVE", required: false, sortOrder: 0 },
      ],
    });
    expect(replaced.map((a) => a.attributeCode)).toEqual(["SIZE"]);
    expect(await replaceCategoryAttributes({ categoryId, attributes: [] })).toEqual([]);
    expect(await listCategoryAttributes(categoryId)).toEqual([]);
  });

  it("chỉ SELECT / COLOR làm trục; thuộc tính ngừng dùng không thêm mới; thuộc tính lạ → 404", async () => {
    const categoryId = await category(3);
    const text = await createAttribute(attributeForm({ dataType: "TEXT" }));
    const axisOnText = await apiError(
      replaceCategoryAttributes({
        categoryId,
        attributes: [
          {
            attributeId: text.attributeId,
            defaultRole: "VARIANT_AXIS",
            required: false,
            sortOrder: 0,
          },
        ],
      }),
    );
    expect(axisOnText.code).toBe("VALIDATION_FAILED");
    // Mô tả thì được.
    await replaceCategoryAttributes({
      categoryId,
      attributes: [
        {
          attributeId: text.attributeId,
          defaultRole: "DESCRIPTIVE",
          required: false,
          sortOrder: 0,
        },
      ],
    });

    const retired = await createAttribute(attributeForm());
    await updateAttribute({
      attributeId: retired.attributeId,
      version: retired.version,
      values: { ...attributeForm({ code: retired.code }), active: false },
    });
    const inactive = await apiError(
      replaceCategoryAttributes({
        categoryId,
        attributes: [
          {
            attributeId: retired.attributeId,
            defaultRole: "DESCRIPTIVE",
            required: false,
            sortOrder: 0,
          },
        ],
      }),
    );
    expect(inactive.code).toBe("VALIDATION_FAILED");
    const unknown = await apiError(
      replaceCategoryAttributes({
        categoryId,
        attributes: [
          { attributeId: "không-có", defaultRole: "DESCRIPTIVE", required: false, sortOrder: 0 },
        ],
      }),
    );
    expect(unknown.code).toBe("ATTRIBUTE_NOT_FOUND");
    await replaceCategoryAttributes({ categoryId, attributes: [] });
  });

  it("FE chặn thuộc tính trùng trong bộ trước khi gọi BE", async () => {
    const entry = {
      attributeId: "ATTR-SIZE",
      defaultRole: "DESCRIPTIVE" as const,
      required: false,
      sortOrder: 0,
    };
    await expect(
      replaceCategoryAttributes({ categoryId: await category(), attributes: [entry, entry] }),
    ).rejects.toThrow();
  });

  it("thuộc tính thuộc bộ của một danh mục thì không xoá được (ATTRIBUTE_IN_USE)", async () => {
    const categoryId = await category(4);
    const attribute = await createAttribute(attributeForm());
    await replaceCategoryAttributes({
      categoryId,
      attributes: [
        {
          attributeId: attribute.attributeId,
          defaultRole: "DESCRIPTIVE",
          required: false,
          sortOrder: 0,
        },
      ],
    });
    expect(
      (
        await apiError(
          deleteAttribute({ attributeId: attribute.attributeId, version: attribute.version }),
        )
      ).code,
    ).toBe("ATTRIBUTE_IN_USE");
    await replaceCategoryAttributes({ categoryId, attributes: [] });
    await expect(
      deleteAttribute({ attributeId: attribute.attributeId, version: attribute.version }),
    ).resolves.toBeUndefined();
  });
});
