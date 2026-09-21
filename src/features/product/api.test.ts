import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { getProduct, listCategories, listProducts, listSkus } from "./api";
import { productKeys } from "./queries";
import { ApiError } from "@/lib/api/error";

afterEach(() => vi.restoreAllMocks());

function backendPage() {
  return {
    items: [],
    page: 2,
    size: 15,
    totalElements: 47,
    totalPages: 4,
    hasNext: true,
    hasPrevious: true,
  };
}

describe("product list API query", () => {
  it("sends backend-supported search and zero-based page parameters", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: backendPage() });

    const result = await listProducts({ page: 3, pageSize: 15, q: "  office chair  " });
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;

    expect(params.get("q")).toBe("office chair");
    expect(params.get("page")).toBe("2");
    expect(params.get("size")).toBe("15");
    expect(result).toMatchObject({
      page: 3,
      pageSize: 15,
      total: 47,
      totalPages: 4,
      hasNext: true,
      hasPrevious: true,
    });
  });

  it("maps display statuses to the exact backend enum values", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: backendPage() });

    await listProducts({
      status: ["Draft", "Pending Approval", "Published", "Discontinued"],
    });
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;

    expect(params.getAll("status")).toEqual([
      "DRAFT",
      "PENDING_APPROVAL",
      "PUBLISHED",
      "DISCONTINUED",
    ]);
  });

  it("puts page and server filters in distinct TanStack Query keys", () => {
    const firstPage = productKeys.list({ page: 1, pageSize: 15, q: "chair", status: ["Draft"] });
    const secondPage = productKeys.list({ page: 2, pageSize: 15, q: "chair", status: ["Draft"] });
    const anotherSearch = productKeys.list({
      page: 1,
      pageSize: 15,
      q: "desk",
      status: ["Approved"],
    });

    expect(secondPage).not.toEqual(firstPage);
    expect(anotherSearch).not.toEqual(firstPage);
  });
});

describe("real ProductResponse compatibility", () => {
  it("does not fabricate legacy business fields absent from the backend DTO", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        productId: "11111111-1111-4111-8111-111111111111",
        code: "PROD-001",
        name: "Áo mẫu",
        nameEn: "Sample Shirt",
        categoryId: null,
        description: null,
        descriptionEn: null,
        brand: "Brand",
        taxClass: "STANDARD",
        customizable: false,
        images: [],
        status: "DRAFT",
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: null,
        submittedBy: null,
        submittedAt: null,
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null,
        weightKg: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
      },
    });

    const product = await getProduct("11111111-1111-4111-8111-111111111111");

    expect(product.basePrice).toBeUndefined();
    expect(product.uom).toBeUndefined();
    expect(product.attributes).toBeUndefined();
  });
});

describe("optional SKU/category capability errors", () => {
  it("does not turn an unavailable SKU endpoint into an empty dataset", async () => {
    vi.spyOn(api, "get").mockRejectedValueOnce(new ApiError(404, "NOT_FOUND", "Not found"));

    await expect(listSkus({ page: 1, pageSize: 15 })).rejects.toMatchObject({ status: 404 });
  });

  it("does not turn an unavailable category endpoint into an empty dataset", async () => {
    vi.spyOn(api, "get").mockRejectedValueOnce(new ApiError(404, "NOT_FOUND", "Not found"));

    await expect(listCategories()).rejects.toMatchObject({ status: 404 });
  });

  it("preserves successful empty responses as empty datasets", async () => {
    vi.spyOn(api, "get")
      .mockResolvedValueOnce({ data: { items: [], page: 1, pageSize: 15, total: 0 } })
      .mockResolvedValueOnce({ data: { items: [], page: 1, pageSize: 15, total: 0 } });

    await expect(listSkus({ page: 1, pageSize: 15 })).resolves.toMatchObject({
      items: [],
      total: 0,
    });
    await expect(listCategories()).resolves.toMatchObject({ items: [], total: 0 });
  });
});
