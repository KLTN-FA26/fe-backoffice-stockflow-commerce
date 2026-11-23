import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { inventoryItemKeys } from "@/lib/references/inventory-item-keys";

import { useSaveItemLogistics } from "./mutations";

import type { ReactNode } from "react";
import type { LogisticsFormValues } from "./types";

vi.mock("./api", () => ({
  saveItemLogistics: vi.fn().mockResolvedValue({}),
}));

const values: LogisticsFormValues = {
  unitOfMeasure: "EACH",
  barcode: "",
  rotatable: true,
};

describe("inventory item mutations — invalidation", () => {
  it("lưu logistics làm mới mọi query hồ sơ hàng tồn", async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSaveItemLogistics(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "item-1", version: 2, values });
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: inventoryItemKeys.all }),
    );
  });
});
