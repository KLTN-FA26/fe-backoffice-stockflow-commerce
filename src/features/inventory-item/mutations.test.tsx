import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { inventoryItemKeys } from "@/lib/references/inventory-item-keys";

import { useSaveItemPolicy } from "./mutations";

import type { ReactNode } from "react";
import type { PolicyFormValues } from "./types";

vi.mock("./api", () => ({
  saveItemLogistics: vi.fn().mockResolvedValue({}),
  saveItemPolicy: vi.fn().mockResolvedValue({}),
}));

const values: PolicyFormValues = {
  reorderPoint: "20",
  safetyStock: "5",
  maxQty: "100",
  maxShelfLifeDays: "",
  removalStrategy: "FIFO",
  trackingMode: "NONE",
  expiryTracked: false,
};

describe("inventory item mutations — invalidation", () => {
  // BE `ItemPurchasingService`: logistics, chính sách tồn và thông tin mua hàng của SKU dùng chung
  // `inventory_items.version` → lưu ở đây thì cache thông tin mua hàng (màn biến thể) phải làm mới.
  it("lưu chính sách tồn làm mới hồ sơ hàng tồn và thông tin mua hàng của SKU", async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSaveItemPolicy(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "item-1", version: 2, values });
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: inventoryItemKeys.all }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [SHARED_QUERY_ROOTS.skuPurchasing] }),
    );
  });
});
