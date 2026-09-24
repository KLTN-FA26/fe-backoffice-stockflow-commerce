import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api";

import { usePublishProduct } from "./mutations";
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
