import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./error";
import { createMutation } from "./query-factory";
import { withStaleRefetch } from "./stale-refetch";

import type { ReactNode } from "react";

afterEach(() => vi.restoreAllMocks());

const LIST = ["things", "list"] as const;
const isStale = (error: unknown) => error instanceof ApiError && error.code === "OPTIMISTIC_LOCK";

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

const failing = (error: unknown) =>
  createMutation<{ id: string }, void>(async () => {
    throw error;
  });

async function run(hook: () => { mutateAsync: (input: { id: string }) => Promise<void> }) {
  const { invalidate, wrapper } = setup();
  const { result } = renderHook(hook, { wrapper });
  await act(async () => {
    await result.current.mutateAsync({ id: "t-1" }).catch(() => undefined);
  });
  return invalidate;
}

describe("withStaleRefetch — lỗi dữ liệu cũ tải lại thật trước khi màn hình báo", () => {
  it("lỗi cũ: invalidate các khoá tĩnh rồi mới gọi onError của màn hình", async () => {
    const order: string[] = [];
    const useSave = withStaleRefetch(
      failing(new ApiError(409, "OPTIMISTIC_LOCK", "x")),
      [LIST],
      isStale,
    );
    const { invalidate, wrapper } = setup();
    invalidate.mockImplementation(async () => void order.push("invalidate"));
    const { result } = renderHook(() => useSave({ onError: () => void order.push("onError") }), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({ id: "t-1" }).catch(() => undefined);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: LIST });
    expect(order).toEqual(["invalidate", "onError"]);
  });

  it("khoá tính theo biến của lần gọi (vd chi tiết đúng bản ghi)", async () => {
    const useSave = withStaleRefetch(
      failing(new ApiError(409, "OPTIMISTIC_LOCK", "x")),
      (input) => [["things", "detail", input.id]],
      isStale,
    );
    const invalidate = await run(() => useSave());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["things", "detail", "t-1"] });
  });

  it("lỗi khác (không phải dữ liệu cũ) không tải lại", async () => {
    const useSave = withStaleRefetch(
      failing(new ApiError(409, "CODE_TAKEN", "x")),
      [LIST],
      isStale,
    );
    expect(await run(() => useSave())).not.toHaveBeenCalled();
  });
});
