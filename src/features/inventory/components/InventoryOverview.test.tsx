import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { createInventoryMockService } from "../mock-service";
import { InventoryOverview } from "./InventoryOverview";

import type { InventoryService } from "../service";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderOverview(service: InventoryService) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NuqsTestingAdapter>
      <QueryClientProvider client={client}>
        <InventoryOverview service={service} />
      </QueryClientProvider>
    </NuqsTestingAdapter>,
  );
}

describe("Inventory foundation", () => {
  it("renders four mock-backed sections without inventory HTTP requests", async () => {
    const get = vi.spyOn(api, "get").mockRejectedValue(new Error("Unexpected HTTP"));
    renderOverview(createInventoryMockService());
    const levels = await screen.findByRole("region", { name: "Stock Levels" });
    expect(within(levels).getByRole("button", { name: "DEMO-SKU-001" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Stock Items" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ATP Lookup" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Reservations" })).toBeInTheDocument();
    expect(screen.getByText(/Dữ liệu minh họa/)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("preserves null lot/expiry instead of inferring dates or condition", async () => {
    renderOverview(createInventoryMockService());
    const items = await screen.findByRole("region", { name: "Stock Items" });
    expect(within(items).getByText("Chưa có số lô")).toBeInTheDocument();
    expect(within(items).getByText("Chưa có hạn dùng")).toBeInTheDocument();
  });

  it("shows loading, then allows retry after a service failure", async () => {
    const mock = createInventoryMockService();
    const service: InventoryService = {
      ...mock,
      loadPreview: vi
        .fn()
        .mockRejectedValueOnce(new Error("Fixture failure"))
        .mockImplementation((signal) => mock.loadPreview(signal)),
    };
    renderOverview(service);
    expect(screen.getByRole("status")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("region", { name: "Stock Levels" })).toBeInTheDocument();
  });

  it("renders an empty section without inventing a record", async () => {
    const mock = createInventoryMockService();
    renderOverview({
      ...mock,
      loadPreview: async (signal) => ({
        ...(await mock.loadPreview(signal)),
        stockLevels: [],
      }),
    });
    expect(await screen.findByText("Chưa có dữ liệu mẫu")).toBeInTheDocument();
  });

  it("filters mock stock rows and reveals the selected row context", async () => {
    const user = userEvent.setup();
    renderOverview(createInventoryMockService());
    const levels = await screen.findByRole("region", { name: "Stock Levels" });
    await user.type(
      within(levels).getByRole("searchbox", { name: "Tìm SKU hoặc sản phẩm" }),
      "DEMO-SKU-024",
    );
    expect(within(levels).getByRole("button", { name: "DEMO-SKU-024" })).toBeInTheDocument();
    expect(within(levels).queryByRole("button", { name: "DEMO-SKU-001" })).not.toBeInTheDocument();
    await user.click(within(levels).getByRole("button", { name: "DEMO-SKU-024" }));
    expect(within(levels).getByRole("status")).toHaveTextContent("DEMO-SKU-024");
  });

  it("pages through mock rows", async () => {
    const user = userEvent.setup();
    renderOverview(createInventoryMockService());
    const levels = await screen.findByRole("region", { name: "Stock Levels" });
    await user.click(within(levels).getByRole("button", { name: "Sau" }));
    expect(within(levels).getByRole("button", { name: "DEMO-SKU-011" })).toBeInTheDocument();
  });
});
