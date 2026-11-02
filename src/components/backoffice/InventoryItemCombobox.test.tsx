import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { InventoryItemCombobox } from "./InventoryItemCombobox";

const ITEMS = ["AAA-1", "BBB-2", "CCC-3"].map((sku, i) => ({
  id: `0b6f6a8e-0000-4000-8000-00000000000${i}`,
  sku,
  unitOfMeasure: "EACH",
  storageClass: "NORMAL",
  trackingMode: "NONE",
  policyConfigured: false,
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => vi.restoreAllMocks());

function renderPicker(props: Partial<Parameters<typeof InventoryItemCombobox>[0]> = {}) {
  vi.spyOn(api, "get").mockResolvedValue({
    data: {
      items: ITEMS,
      page: 0,
      size: 20,
      totalElements: ITEMS.length,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  });
  const onSelect = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <InventoryItemCombobox id="sku" value="" ariaLabel="SKU" onSelect={onSelect} {...props} />
    </QueryClientProvider>,
  );
  return onSelect;
}

describe("InventoryItemCombobox", () => {
  it("mặc định hiện mọi hồ sơ hàng tồn và trả SKU đã chọn", async () => {
    const user = userEvent.setup();
    const onSelect = renderPicker();
    await user.click(screen.getByRole("combobox", { name: "SKU" }));
    for (const { sku } of ITEMS) {
      expect(await screen.findByRole("option", { name: new RegExp(sku) })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("option", { name: /BBB-2/ }));
    expect(onSelect).toHaveBeenCalledWith("BBB-2");
  });

  it("chỉ ẩn SKU khi màn gọi truyền hiddenSkus", async () => {
    const user = userEvent.setup();
    renderPicker({ hiddenSkus: new Set(["BBB-2"]) });
    await user.click(screen.getByRole("combobox", { name: "SKU" }));
    expect(await screen.findByRole("option", { name: /AAA-1/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /BBB-2/ })).not.toBeInTheDocument();
  });
});
