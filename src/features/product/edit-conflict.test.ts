import { describe, expect, it } from "vitest";

import { PRODUCT_STATUS } from "@/constants";

import { productToDraftForm } from "./create-product-form";
import { conflictingFields } from "./edit-conflict";

import type { Product } from "./types";

const product = (patch: Partial<Product> = {}): Product => ({
  productId: "p-1",
  code: "TOTE",
  name: "Túi tote",
  nameEn: "Tote bag",
  type: "Standard",
  categoryId: "cat-1",
  status: PRODUCT_STATUS.DRAFT,
  version: 1,
  description: "",
  descriptionEn: "",
  images: [],
  taxClass: "standard",
  brand: "A",
  brandId: "brand-1",
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: "tester",
  ...patch,
});

describe("conflictingFields — 409 khi sửa sản phẩm", () => {
  it("nêu ô người khác vừa đổi mà nội dung đang nhập khác bản mới (lưu tiếp sẽ ghi đè)", () => {
    const base = product();
    const latest = product({ description: "Mô tả của người khác", version: 2 });
    const input = { ...productToDraftForm(base), name: "Bản của tôi" };
    expect(conflictingFields(base, latest, input)).toEqual(["Mô tả tiếng Việt"]);
  });

  it("không nêu ô chỉ người dùng sửa, hay ô server đổi trùng đúng giá trị người dùng nhập", () => {
    const base = product();
    const latest = product({ taxClass: "reduced", version: 2 });
    const input = {
      ...productToDraftForm(base),
      name: "Bản của tôi",
      taxClass: "REDUCED" as const,
    };
    expect(conflictingFields(base, latest, input)).toEqual([]);
  });

  it("cả hai cùng sửa một ô khác nhau → nêu ô đó; thương hiệu / danh mục theo nhãn của form", () => {
    const base = product();
    const latest = product({ name: "Tên của người khác", brandId: "brand-2", version: 2 });
    const input = { ...productToDraftForm(base), name: "Bản của tôi" };
    expect(conflictingFields(base, latest, input)).toEqual(["Tên sản phẩm", "Thương hiệu"]);
  });

  it("thiếu bản gốc → so thẳng bản mới với nội dung đang nhập", () => {
    const latest = product({ nameEn: "Bag", version: 2 });
    expect(conflictingFields(undefined, latest, productToDraftForm(product()))).toEqual([
      "Tên tiếng Anh",
    ]);
  });
});
