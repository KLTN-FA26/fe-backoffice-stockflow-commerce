import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { VariantPicker } from "./VariantPicker";

const PRODUCTS_BY_Q: Record<string, { productId: string; code: string; name: string }[]> = {
  "": [],
  tui: [{ productId: "p-tui", code: "TUI", name: "Túi giấy quai xoắn" }],
  "tui kraft": [{ productId: "p-kraft", code: "TK", name: "Túi giấy kraft" }],
};

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => vi.restoreAllMocks());

function renderPicker() {
  const get = vi.spyOn(api, "get").mockImplementation(async (url: string, config?: unknown) => {
    if (url === "/products") {
      const q = (config as { params: URLSearchParams }).params.get("q") ?? "";
      const items = PRODUCTS_BY_Q[q] ?? [];
      return {
        data: {
          items,
          page: 0,
          size: 10,
          totalElements: items.length,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      };
    }
    return { data: { items: [], page: 0, size: 200, totalElements: 0, totalPages: 0 } };
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <VariantPicker value="" priced={new Set()} onSelect={vi.fn()} />
    </QueryClientProvider>,
  );
  return get;
}

describe("VariantPicker — ô chọn sản phẩm", () => {
  it("gõ thêm rồi Enter ngay (chưa qua debounce) → KHÔNG chọn sản phẩm của lần tìm trước; có kết quả mới thì Enter chọn đúng", async () => {
    const user = userEvent.setup();
    const get = renderPicker();
    const box = screen.getByRole("combobox", { name: "Sản phẩm" });

    await user.type(box, "tui");
    await screen.findByRole("option", { name: /Túi giấy quai xoắn/ });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Túi giấy quai xoắn/ })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );

    // Gõ thêm " kraft" và Enter ngay: danh sách đang hiện vẫn là của "tui"
    await user.type(box, " kraft{Enter}");
    expect(get.mock.calls.some(([url]) => String(url) === "/products/p-tui/variants")).toBe(false);
    expect(box).toHaveValue("tui kraft");

    // Kết quả của "tui kraft" về → Enter chọn đúng sản phẩm đó
    await screen.findByRole("option", { name: /Túi giấy kraft/ });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Túi giấy kraft/ })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
    await user.keyboard("{Enter}");
    await waitFor(() => expect(box).toHaveValue("Túi giấy kraft"));
    expect(get.mock.calls.some(([url]) => String(url) === "/products/p-tui/variants")).toBe(false);
  });
});
