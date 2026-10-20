import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { supplierItemSchema } from "@/lib/references/supplier-items";

import { apiSupplierItem } from "../../../__fixtures__/supplier-item";
import { useSupplierItemDeletion } from "./useSupplierItemsState";

const item = supplierItemSchema.parse(apiSupplierItem);

function renderDeletion() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useSupplierItemDeletion(apiSupplierItem.supplierId, vi.fn()), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("useSupplierItemDeletion — hộp xác nhận xoá", () => {
  it("đóng hộp → isOpen false nhưng giữ target (nội dung không đổi trong lúc animation đóng)", () => {
    const { result } = renderDeletion();
    act(() => result.current.open(item));
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.target?.sku).toBe(item.sku);
  });

  it("confirm sau khi đã đóng → không gọi DELETE", () => {
    const del = vi.spyOn(api, "delete").mockResolvedValue({ data: undefined });
    const { result } = renderDeletion();
    act(() => result.current.open(item));
    act(() => result.current.close());
    act(() => result.current.confirm());
    expect(del).not.toHaveBeenCalled();
  });

  it("confirm khi đang mở → DELETE đúng version, xong thì đóng", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValue({ data: undefined });
    const { result } = renderDeletion();
    act(() => result.current.open(item));
    act(() => result.current.confirm());
    await waitFor(() => expect(result.current.isOpen).toBe(false));
    expect(del).toHaveBeenCalledTimes(1);
    expect(String(del.mock.calls[0]?.[0])).toContain(item.supplierItemId);
  });
});
