import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  discontinueProduct,
  getProduct,
  listProducts,
  publishProduct,
  transitionProduct,
  unpublishProduct,
  updateProduct,
} from "./api";
import { productKeys } from "./queries";

afterEach(() => vi.restoreAllMocks());

const backendProduct = {
  productId: "11111111-1111-4111-8111-111111111111",
  code: "CHAIR-01",
  name: "Ghế",
  nameEn: "Chair",
  slug: null,
  brandId: "33333333-3333-4333-8333-333333333333",
  brandName: "StockFlow",
  categoryId: null,
  shortDescription: null,
  description: null,
  descriptionEn: null,
  taxClass: "STANDARD",
  kind: "CUSTOMIZABLE",
  status: "DRAFT",
  version: 3,
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: "system",
  submittedBy: "22222222-2222-4222-8222-222222222222",
  submittedAt: "2026-01-02T00:00:00Z",
  approvedBy: null,
  approvedAt: null,
  rejectionReason: null,
  publishedAt: null,
  discontinuedAt: null,
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

  it("maps BE PR #71 brand / kind / slug fields; images live on variants, not the product", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: { ...backendProduct, slug: "ghe" } });

    const product = await getProduct(backendProduct.productId);

    expect(product).toMatchObject({
      brand: "StockFlow",
      brandId: backendProduct.brandId,
      type: "Customizable",
      slug: "ghe",
      images: [],
    });
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

    expect(post).toHaveBeenCalledWith(`/products/${backendProduct.productId}/rejection`, {
      reason: "Fix copy",
    });
    await expect(
      transitionProduct({ id: backendProduct.productId, action: "reject", reason: " " }),
    ).rejects.toThrow("Rejection reason is required");
  });

  it.each([
    ["submit", "submission", "PENDING_APPROVAL"],
    ["approve", "approval", "APPROVED"],
  ] as const)("maps %s to the backend %s transition", async (action, suffix, status) => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: { ...backendProduct, status },
    });

    const result = await transitionProduct({ id: backendProduct.productId, action });

    expect(post).toHaveBeenCalledWith(`/products/${backendProduct.productId}/${suffix}`, undefined);
    expect(result.status).toBe(
      { PENDING_APPROVAL: "Pending Approval", APPROVED: "Approved" }[status],
    );
  });

  it("keeps the product version read from the backend (needed by update / discontinue)", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: backendProduct });

    expect((await getProduct(backendProduct.productId)).version).toBe(3);
  });

  it("PUT sends the version last read (BE UpdateProductRequest.version is @NotNull)", async () => {
    const put = vi
      .spyOn(api, "put")
      .mockResolvedValueOnce({ data: { ...backendProduct, version: 4 } });

    const saved = await updateProduct({
      id: backendProduct.productId,
      name: "Ghế",
      nameEn: "Chair",
      categoryId: "44444444-4444-4444-8444-444444444444",
      brandId: backendProduct.brandId,
      shortDescription: "",
      description: "",
      descriptionEn: "",
      taxClass: "STANDARD",
      kind: "STANDARD",
      version: 3,
    });

    expect(put).toHaveBeenCalledWith(
      `/products/${backendProduct.productId}`,
      expect.objectContaining({ version: 3, name: "Ghế" }),
    );
    expect(saved.version).toBe(4);
  });

  it("discontinuation posts { reason, version } and surfaces the warnings", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: {
        ...backendProduct,
        status: "DISCONTINUED",
        version: 4,
        warnings: ["OPEN_PURCHASE_ORDER_LINES"],
        openReferences: [],
        openReferencesTruncated: false,
      },
    });

    const result = await discontinueProduct({
      id: backendProduct.productId,
      reason: "  Ngừng sản xuất  ",
      version: 3,
    });

    expect(post).toHaveBeenCalledWith(`/products/${backendProduct.productId}/discontinuation`, {
      reason: "Ngừng sản xuất",
      version: 3,
    });
    expect(result.product.status).toBe("Discontinued");
    expect(result.warnings).toEqual(["OPEN_PURCHASE_ORDER_LINES"]);
  });

  it("refuses to discontinue without a reason or over the BE 500-character limit", async () => {
    const post = vi.spyOn(api, "post");

    await expect(
      discontinueProduct({ id: backendProduct.productId, reason: "  ", version: 3 }),
    ).rejects.toThrow();
    await expect(
      discontinueProduct({ id: backendProduct.productId, reason: "x".repeat(501), version: 3 }),
    ).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it("parses a suspended (INACTIVE) product instead of failing the whole page", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        ...backendPage(),
        items: [backendProduct, { ...backendProduct, productId: "p2", status: "INACTIVE" }],
      },
    });

    const page = await listProducts({});

    expect(page.items.map((p) => p.status)).toEqual(["Draft", "Inactive"]);
  });

  it("an unknown future status falls back to UNKNOWN and does not throw", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        ...backendPage(),
        items: [{ ...backendProduct, status: "SOME_FUTURE_STATUS" }, backendProduct],
      },
    });

    const page = await listProducts({});

    expect(page.items.map((p) => p.status)).toEqual(["UNKNOWN", "Draft"]);
  });

  it("filters the list by INACTIVE too", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: backendPage() });

    await listProducts({ status: ["Inactive"] });

    expect((get.mock.calls[0]?.[1]?.params as URLSearchParams).getAll("status")).toEqual([
      "INACTIVE",
    ]);
  });

  it("handles publication and unpublication as void responses", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });

    await expect(publishProduct(backendProduct.productId)).resolves.toBeUndefined();
    await expect(unpublishProduct(backendProduct.productId)).resolves.toBeUndefined();

    expect(post).toHaveBeenNthCalledWith(1, `/products/${backendProduct.productId}/publication`);
    expect(post).toHaveBeenNthCalledWith(2, `/products/${backendProduct.productId}/unpublication`);
  });
});
