import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { inventoryItemKeys } from "@/lib/references/inventory-item-keys";
import { supplierItemKeys, supplierItemSchema } from "@/lib/references/supplier-items";

import { apiSupplierItem } from "./__fixtures__/supplier-item";
import {
  useCreateSupplierItem,
  useDeleteSupplierItem,
  useUpdateSupplierItem,
} from "./item-mutations";

import type { ReactNode } from "react";
import type { SupplierItemFormValues } from "./types";

afterEach(() => vi.restoreAllMocks());

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

const values: SupplierItemFormValues = {
  sku: apiSupplierItem.sku,
  supplierSkuCode: "",
  price: "100",
  moq: "1",
  packSize: "1",
  leadTimeDays: "",
  preferred: true,
};

const item = supplierItemSchema.parse(apiSupplierItem);
const supplierId = item.supplierId;

describe("supplier item mutations — invalidation", () => {
  // BE ItemPurchasingRepository.assign/clearDefaultSupplier: đổi "ưu tiên" ghi default_supplier_id
  // và tăng `version` của hồ sơ hàng tồn → cache hồ sơ hàng tồn phải làm mới, kẻo PUT sau 409.
  it("tạo / sửa / xoá đều làm mới danh mục và hồ sơ hàng tồn", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: apiSupplierItem });
    vi.spyOn(api, "put").mockResolvedValue({ data: apiSupplierItem });
    vi.spyOn(api, "delete").mockResolvedValue({ data: null });
    const { invalidate, wrapper } = setup();
    const create = renderHook(() => useCreateSupplierItem(), { wrapper }).result;
    const update = renderHook(() => useUpdateSupplierItem(), { wrapper }).result;
    const remove = renderHook(() => useDeleteSupplierItem(), { wrapper }).result;

    for (const run of [
      () => create.current.mutateAsync({ supplierId, values }),
      () => update.current.mutateAsync({ supplierId, item, values }),
      () => remove.current.mutateAsync({ supplierId, item }),
    ]) {
      invalidate.mockClear();
      await act(async () => {
        await run();
      });
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: supplierItemKeys.all }),
      );
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: inventoryItemKeys.all }),
      );
    }
  });
});
