import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api";

import { useSuspendProduct, usePublishProduct, useUpdateProduct } from "./mutations";
import { listingKeys } from "./listing-queries";
import { productKeys } from "./queries";

import type { ReactNode } from "react";

afterEach(() => vi.restoreAllMocks());

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

describe("product publication mutation", () => {
  it("accepts the backend void response and invalidates product queries", async () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({ data: null });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => usePublishProduct(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("11111111-1111-4111-8111-111111111111");
    });

    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: productKeys.all }));
  });

  it("does not invalidate or turn a permission failure into success", async () => {
    vi.spyOn(api, "post").mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "Forbidden"));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => usePublishProduct(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync("11111111-1111-4111-8111-111111111111");
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

// Revision của listing / giá CHÍNH LÀ version của sản phẩm (BE CatalogCommerceService.get): đổi sản phẩm
// làm cũ listing + giá, và ngược lại.
describe("product mutations also refresh the listing and prices that share its version", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  const product = {
    productId: ID,
    code: "A",
    name: "A",
    taxClass: "STANDARD",
    kind: "STANDARD",
    status: "INACTIVE",
    version: 4,
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("suspend", async () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({ data: product });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSuspendProduct(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: ID, reason: "x", version: 3 });
    });
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: productKeys.all }));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: listingKeys.all }));
  });

  it("update and publish", async () => {
    vi.spyOn(api, "put").mockResolvedValueOnce({ data: { ...product, status: "DRAFT" } });
    vi.spyOn(api, "post").mockResolvedValueOnce({ data: null });
    const { invalidate, wrapper } = setup();
    const update = renderHook(() => useUpdateProduct(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({
        id: ID,
        name: "A",
        nameEn: "A",
        categoryId: "c",
        brandId: "b",
        description: "",
        descriptionEn: "",
        taxClass: "STANDARD",
        kind: "STANDARD",
        version: 3,
      });
    });
    const publish = renderHook(() => usePublishProduct(), { wrapper });
    await act(async () => {
      await publish.result.current.mutateAsync(ID);
    });
    const keys = invalidate.mock.calls.map((c) =>
      JSON.stringify((c[0] as { queryKey: unknown }).queryKey),
    );
    expect(keys.filter((k) => k === JSON.stringify(listingKeys.all))).toHaveLength(2);
  });
});
