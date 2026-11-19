import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { findProductDuplicates } from "./api";
import { ProductDuplicateList } from "./components/ProductDuplicateWarning";
import { parseProduct } from "./product-parse";

afterEach(() => vi.restoreAllMocks());

const match = { productId: "p-2", code: "CUP-12OZ", name: "Ly giấy 12oz", status: "DRAFT" };

describe("cảnh báo sản phẩm có thể trùng (BE /products/duplicates, docs 01 §4.3, BR-16)", () => {
  it("gửi tên, thương hiệu, danh mục, bỏ sản phẩm đang sửa; parse ProductMatchResponse", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: [match] });
    const result = await findProductDuplicates({
      name: "Ly giay 12 oz",
      brandId: "b-1",
      categoryId: "c-1",
      excludeProductId: "p-1",
    });
    expect(get.mock.calls[0]?.[0]).toBe("/products/duplicates");
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;
    expect(Object.fromEntries(params)).toEqual({
      name: "Ly giay 12 oz",
      brandId: "b-1",
      categoryId: "c-1",
      excludeProductId: "p-1",
    });
    expect(result).toEqual([match]);
  });

  it("ProductResponse.possibleDuplicates đi vào Product; null thì bỏ", () => {
    const base = {
      productId: "p-1",
      code: "CUP",
      name: "Ly",
      taxClass: "STANDARD",
      kind: "CUSTOMIZABLE",
      status: "DRAFT",
      version: 0,
      createdAt: "2026-01-01T00:00:00Z",
    };
    expect(parseProduct({ ...base, possibleDuplicates: [match] }).possibleDuplicates).toEqual([
      match,
    ]);
    expect(parseProduct({ ...base, possibleDuplicates: null }).possibleDuplicates).toBeUndefined();
  });

  it("danh sách cảnh báo hiện mã + tên + trạng thái, link sang sản phẩm; rỗng thì không hiện gì", () => {
    const { rerender, container } = render(<ProductDuplicateList matches={[match]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Có thể trùng với 1 sản phẩm");
    expect(screen.getByRole("link", { name: "CUP-12OZ" })).toHaveAttribute(
      "href",
      "/admin/products/p-2",
    );
    rerender(<ProductDuplicateList matches={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
