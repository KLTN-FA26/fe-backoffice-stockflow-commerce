import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { api } from "@/lib/api/client";

import { useDecidePartialShipment } from "./mutations";
import { orderKeys } from "./queries";

import type { ReactNode } from "react";

afterEach(() => vi.restoreAllMocks());

describe("useDecidePartialShipment — làm mới những gì phụ thuộc cờ giao một phần", () => {
  it("invalidate đơn + lịch sử, task / phiên đóng gói và chuyến xe; không đụng dữ liệu khác", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: null });
    const client = new QueryClient();
    const keys = {
      detail: orderKeys.detail("o1"),
      history: orderKeys.history("o1"),
      packing: [SHARED_QUERY_ROOTS.fulfillmentTasks, "packing", "session", "t1"],
      tasks: [SHARED_QUERY_ROOTS.fulfillmentTasks, "list", {}],
      loads: [SHARED_QUERY_ROOTS.fulfillmentLoads, "list", {}],
      unrelated: ["suppliers", "list"],
    } as const;
    for (const key of Object.values(keys)) client.setQueryData(key, { cached: true });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDecidePartialShipment(), { wrapper });

    await act(async () => result.current.mutate({ id: "o1", allowed: true, note: "" }));

    const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
    await waitFor(() => expect(stale(keys.detail)).toBe(true));
    expect(stale(keys.history)).toBe(true);
    expect(stale(keys.packing)).toBe(true);
    expect(stale(keys.tasks)).toBe(true);
    expect(stale(keys.loads)).toBe(true);
    expect(stale(keys.unrelated)).toBe(false);
  });
});
