import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { SHARED_QUERY_ROOTS } from "@/constants";
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
  weightKg: "1",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  packageWeightKg: "",
  packageLengthCm: "",
  packageWidthCm: "",
  packageHeightCm: "",
  packageCount: "1",
  packSize: "1",
  rotatable: true,
};

describe("inventory item mutations — invalidation", () => {
  // Logistics và thông tin mua hàng của SKU dùng chung `inventory_items.version` → lưu ở đây thì
  // cache thông tin mua hàng (màn biến thể) phải làm mới.
  it("lưu logistics làm mới hồ sơ hàng tồn và thông tin mua hàng của SKU", async () => {
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
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [SHARED_QUERY_ROOTS.skuPurchasing] }),
    );
  });
});
