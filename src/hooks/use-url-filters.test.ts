import { act, renderHook, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";

import { useUrlFilters } from "./use-url-filters";

const STATUSES = ["Draft", "Approved"] as const;
const keys = { page: "productPage", q: "productQ", status: "productStatus" };

describe("useUrlFilters page reset", () => {
  it("resets an invalid page when search changes", async () => {
    const { result } = renderHook(() => useUrlFilters(STATUSES, { keys }), {
      wrapper: withNuqsTestingAdapter({
        searchParams: "?productPage=5",
        hasMemory: true,
      }),
    });

    act(() => result.current.setQ("chair"));

    await waitFor(() => expect(result.current.page).toBe(1));
  });

  it("resets an invalid page when status filters change", async () => {
    const { result } = renderHook(() => useUrlFilters(STATUSES, { keys }), {
      wrapper: withNuqsTestingAdapter({
        searchParams: "?productPage=4",
        hasMemory: true,
      }),
    });

    act(() => result.current.setStatus(["Approved"]));

    await waitFor(() => expect(result.current.page).toBe(1));
  });
});
