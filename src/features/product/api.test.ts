import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { listProducts } from "./api";
import { productKeys } from "./queries";

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
