import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { listProducts } from "./api";

afterEach(() => vi.restoreAllMocks());

const emptyPage = {
  items: [],
  page: 0,
  size: 15,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

describe("listProducts — lọc danh mục / thương hiệu (BE ListProductsQuery)", () => {
  it("gửi categoryId và brandId khi có, bỏ khi trống", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: emptyPage });
    await listProducts({ page: 0, categoryId: "cat-1", brandId: "brand-1" });
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;
    expect(params.get("categoryId")).toBe("cat-1");
    expect(params.get("brandId")).toBe("brand-1");

    await listProducts({ page: 0 });
    const plain = get.mock.calls[1]?.[1]?.params as URLSearchParams;
    expect(plain.has("categoryId")).toBe(false);
    expect(plain.has("brandId")).toBe(false);
  });
});
