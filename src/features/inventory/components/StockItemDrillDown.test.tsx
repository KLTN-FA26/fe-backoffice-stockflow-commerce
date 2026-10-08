import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createStockItemsFixture, createStockLevelsFixture } from "../fixtures";
import { createInventoryMockService } from "../mock-service";
import { StockItemDrillDown } from "./StockItemDrillDown";

import type { InventoryService } from "../service";
import type { StockItemRow } from "../types";

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});

function renderDrillDown(service: InventoryService) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const selected = createStockLevelsFixture()[0];
  render(
    <QueryClientProvider client={client}>
      <StockItemDrillDown selected={selected} service={service} />
    </QueryClientProvider>,
  );
  return client;
}

describe("Stock Item query states", () => {
  it("shows a paused message instead of loading offline, then fetches on reconnect", async () => {
    onlineManager.setOnline(false);
    let complete: ((rows: StockItemRow[]) => void) | undefined;
    const service: InventoryService = {
      ...createInventoryMockService(),
      loadStockItems: vi.fn(
        () =>
          new Promise<StockItemRow[]>((resolve) => {
            complete = resolve;
          }),
      ),
    };
    renderDrillDown(service);

    expect(await screen.findByRole("status")).toHaveTextContent("Tạm dừng tải stock item");
    expect(screen.queryByRole("status", { name: "Đang tải nội dung" })).not.toBeInTheDocument();
    expect(service.loadStockItems).not.toHaveBeenCalled();
    expect(screen.queryByText("Chưa có stock item cho SKU và kho này")).not.toBeInTheDocument();

    act(() => onlineManager.setOnline(true));
    expect(await screen.findByRole("status", { name: "Đang tải nội dung" })).toBeInTheDocument();
    expect(screen.queryByText(/Tạm dừng tải stock item/)).not.toBeInTheDocument();
    await act(async () => complete?.(createStockItemsFixture()));
    expect(await screen.findByText("DEMO-LOT-1")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps cached rows visible when a background refresh is paused offline", async () => {
    const service = createInventoryMockService();
    const loadStockItems = vi.spyOn(service, "loadStockItems");
    const client = renderDrillDown(service);
    expect(await screen.findByText("DEMO-LOT-1")).toBeInTheDocument();

    act(() => {
      onlineManager.setOnline(false);
      void client.invalidateQueries();
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Tạm dừng tải stock item");
    expect(screen.getByText("DEMO-LOT-1")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(loadStockItems).toHaveBeenCalledOnce();

    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(loadStockItems).toHaveBeenCalledTimes(2);
    expect(screen.getByText("DEMO-LOT-1")).toBeInTheDocument();
  });

  it("shows background fetching progress without replacing successful rows", async () => {
    const service = createInventoryMockService();
    const client = renderDrillDown(service);
    expect(await screen.findByText("DEMO-LOT-1")).toBeInTheDocument();
    let complete: ((rows: StockItemRow[]) => void) | undefined;
    vi.spyOn(service, "loadStockItems").mockImplementationOnce(
      () =>
        new Promise<StockItemRow[]>((resolve) => {
          complete = resolve;
        }),
    );

    act(() => {
      void client.invalidateQueries();
    });
    expect(
      await screen.findByRole("progressbar", { name: "Đang tải lại stock item" }),
    ).toBeInTheDocument();
    expect(screen.getByText("DEMO-LOT-1")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Đang tải nội dung" })).not.toBeInTheDocument();
    await act(async () => complete?.(createStockItemsFixture()));
    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
    expect(screen.getByText("DEMO-LOT-1")).toBeInTheDocument();
  });
});
