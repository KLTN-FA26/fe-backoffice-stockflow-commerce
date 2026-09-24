import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  getProduct,
  listProducts,
  publishProduct,
  transitionProduct,
  unpublishProduct,
} from "./api";
import { productKeys } from "./queries";

afterEach(() => vi.restoreAllMocks());

const backendProduct = {
  productId: "11111111-1111-4111-8111-111111111111",
  code: "CHAIR-01",
  name: "Ghế",
  nameEn: "Chair",
  categoryId: null,
  description: null,
  descriptionEn: null,
  brand: "StockFlow",
  taxClass: "STANDARD",
  customizable: false,
  images: [],
  status: "DRAFT",
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: "system",
  submittedBy: "22222222-2222-4222-8222-222222222222",
  submittedAt: "2026-01-02T00:00:00Z",
  approvedBy: null,
  approvedAt: null,
  rejectionReason: null,
  weightKg: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
};

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

describe("product API contract", () => {
  it("uses the backend zero-based pagination contract without hidden conversion", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: backendPage() });

    const result = await listProducts({ page: 2, size: 15, q: "  office chair  " });
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;

    expect(params.get("q")).toBe("office chair");
    expect(params.get("page")).toBe("2");
    expect(params.get("size")).toBe("15");
    expect(result).toEqual(backendPage());
  });

  it("does not fabricate catalog price, UoM, attributes, or slug from ProductResponse", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: backendProduct });

    const product = await getProduct(backendProduct.productId);

    expect(product).not.toHaveProperty("basePrice");
    expect(product).not.toHaveProperty("uom");
    expect(product).not.toHaveProperty("attributes");
    expect(product).not.toHaveProperty("slug");
    expect(product.submittedBy).toBe(backendProduct.submittedBy);
  });

  it("maps display statuses to the exact backend enum values", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: backendPage() });

    await listProducts({ status: ["Draft", "Pending Approval", "Published", "Discontinued"] });
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;

    expect(params.getAll("status")).toEqual([
      "DRAFT",
      "PENDING_APPROVAL",
      "PUBLISHED",
      "DISCONTINUED",
    ]);
  });

  it("forwards only the selected backend sort expression", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: backendPage() });

    await listProducts({ page: 0, size: 15, sort: "name,desc" });

    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;
    expect(params.get("sort")).toBe("name,desc");
  });

  it("uses distinct query keys for page, filters, and server sort", () => {
    const firstPage = productKeys.list({ page: 0, size: 15, q: "chair", sort: "code,asc" });
    const secondPage = productKeys.list({ page: 1, size: 15, q: "chair", sort: "code,asc" });
    const anotherSort = productKeys.list({ page: 0, size: 15, q: "chair", sort: "name,desc" });

    expect(secondPage).not.toEqual(firstPage);
    expect(anotherSort).not.toEqual(firstPage);
  });

  it("sends a nonblank rejection reason and parses data-returning transitions", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: { ...backendProduct, status: "DRAFT", submittedBy: null, submittedAt: null },
    });

    await transitionProduct({ id: backendProduct.productId, action: "reject", reason: "Fix copy" });

    expect(post).toHaveBeenCalledWith(`/v1/products/${backendProduct.productId}/rejection`, {
      reason: "Fix copy",
    });
    await expect(
      transitionProduct({ id: backendProduct.productId, action: "reject", reason: " " }),
    ).rejects.toThrow("Rejection reason is required");
  });

  it.each([
    ["submit", "submission", "PENDING_APPROVAL"],
    ["approve", "approval", "APPROVED"],
    ["discontinue", "discontinuation", "DISCONTINUED"],
  ] as const)("maps %s to the backend %s transition", async (action, suffix, status) => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: { ...backendProduct, status },
    });

    const result = await transitionProduct({ id: backendProduct.productId, action });

    expect(post).toHaveBeenCalledWith(
      `/v1/products/${backendProduct.productId}/${suffix}`,
      undefined,
    );
    expect(result.status).toBe(
      { PENDING_APPROVAL: "Pending Approval", APPROVED: "Approved", DISCONTINUED: "Discontinued" }[
        status
      ],
    );
  });

  it("handles publication and unpublication as void responses", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });

    await expect(publishProduct(backendProduct.productId)).resolves.toBeUndefined();
    await expect(unpublishProduct(backendProduct.productId)).resolves.toBeUndefined();

    expect(post).toHaveBeenNthCalledWith(1, `/v1/products/${backendProduct.productId}/publication`);
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/v1/products/${backendProduct.productId}/unpublication`,
    );
  });
});
