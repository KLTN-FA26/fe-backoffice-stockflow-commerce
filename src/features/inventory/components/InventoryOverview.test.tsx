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
    const user = userEvent.setup();
    renderOverview(createInventoryMockService());
    const levels = await screen.findByRole("region", { name: "Stock Levels" });
    await user.click(within(levels).getByRole("button", { name: "DEMO-SKU-001" }));
    const items = await screen.findByRole("region", { name: "Stock Items" });
    expect(await within(items).findByText("Chưa có số lô")).toBeInTheDocument();
    expect(within(items).getByText("Chưa có hạn dùng")).toBeInTheDocument();
    expect(
      within(items)
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[2].textContent),
    ).toEqual(["DEMO-LOT-1", "DEMO-LOT-2", "Chưa có số lô"]);
    expect(within(items).getByText("Trạng thái mẫu A")).toBeInTheDocument();
    expect(within(items).getByText("Tình trạng mẫu B")).toBeInTheDocument();
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

  it("filters mock stock rows and shows an empty drill-down for the selected SKU", async () => {
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
    const items = screen.getByRole("region", { name: "Stock Items" });
    expect(
      await within(items).findByText("Chưa có stock item cho SKU và kho này"),
    ).toBeInTheDocument();
    expect(within(items).getByText("DEMO-SKU-024")).toBeInTheDocument();
  });

  it("pages through mock rows", async () => {
    const user = userEvent.setup();
    renderOverview(createInventoryMockService());
    const levels = await screen.findByRole("region", { name: "Stock Levels" });
    await user.click(within(levels).getByRole("button", { name: "Sau" }));
    expect(within(levels).getByRole("button", { name: "DEMO-SKU-011" })).toBeInTheDocument();
  });

  it("shows detail loading and then stock items for the selected SKU", async () => {
    const user = userEvent.setup();
    const mock = createInventoryMockService();
    let complete:
      ((items: Awaited<ReturnType<InventoryService["loadStockItems"]>>) => void) | undefined;
    const service: InventoryService = {
      ...mock,
      loadStockItems: () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    };
    renderOverview(service);
    const levels = await screen.findByRole("region", { name: "Stock Levels" });
    await user.click(within(levels).getByRole("button", { name: "DEMO-SKU-001" }));
    const items = screen.getByRole("region", { name: "Stock Items" });
    expect(within(items).getByRole("status", { name: "Đang tải nội dung" })).toBeInTheDocument();
    complete?.(await mock.loadStockItems("DEMO-SKU-001", "DEMO-WH"));
    expect(await within(items).findByText("DEMO-LOT-1")).toBeInTheDocument();
  });

  it("retries a failed stock-item query independently of the overview", async () => {
    const user = userEvent.setup();
    const mock = createInventoryMockService();
    const service: InventoryService = {
      ...mock,
      loadStockItems: vi
        .fn()
        .mockRejectedValueOnce(new Error("Fixture failure"))
        .mockImplementation((sku, warehouseCode, signal) =>
          mock.loadStockItems(sku, warehouseCode, signal),
        ),
    };
    renderOverview(service);
    const levels = await screen.findByRole("region", { name: "Stock Levels" });
    await user.click(within(levels).getByRole("button", { name: "DEMO-SKU-001" }));
    const items = screen.getByRole("region", { name: "Stock Items" });
    expect(
      await within(items).findByText("Không tải được stock item minh họa"),
    ).toBeInTheDocument();
    await user.click(within(items).getByRole("button", { name: "Thử lại" }));
    expect(await within(items).findByText("DEMO-LOT-1")).toBeInTheDocument();
    expect(within(levels).getByRole("button", { name: "DEMO-SKU-001" })).toBeInTheDocument();
  });
});
