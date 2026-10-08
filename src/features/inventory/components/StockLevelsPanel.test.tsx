import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "@/constants/storage-keys";

import { createStockLevelsFixture } from "../fixtures";
import { StockLevelsPanel } from "./StockLevelsPanel";

import type { OnUrlUpdateFunction } from "nuqs/adapters/testing";

beforeEach(() => {
  window.localStorage.removeItem(STORAGE_KEYS.adminInventoryConfig);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(STORAGE_KEYS.adminInventoryConfig);
});

function renderLevels(searchParams = "", onUrlUpdate = vi.fn<OnUrlUpdateFunction>()) {
  return render(
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
      <StockLevelsPanel rows={createStockLevelsFixture()} onSelect={vi.fn()} />
    </NuqsTestingAdapter>,
  );
}

describe("Inventory page-size preference", () => {
  it("changes page size, resets the URL page, preserves filters and survives remount", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const view = renderLevels(
      "?inventoryPage=2&inventoryQ=DEMO&inventoryWarehouse=all",
      onUrlUpdate,
    );
    expect(screen.getByText("Hiển thị 11–20 / 24")).toBeInTheDocument();
    const size = screen.getByRole("combobox", { name: "Dòng mỗi trang" });
    size.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");

    await waitFor(() => expect(size).toHaveTextContent("20"));
    expect(window.localStorage.getItem(STORAGE_KEYS.adminInventoryConfig)).toBe(
      JSON.stringify({ pageSize: 20 }),
    );
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const update = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(update?.searchParams.get("inventoryPage")).toBeNull();
    expect(update?.searchParams.get("inventoryQ")).toBe("DEMO");
    expect(update?.searchParams.get("inventoryWarehouse")).toBe("all");
    expect(update?.searchParams.has("inventoryPageSize")).toBe(false);

    view.unmount();
    renderLevels();
    expect(await screen.findByText("Hiển thị 1–20 / 24")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Dòng mỗi trang" })).toHaveTextContent("20");
  });

  it.each([null, { pageSize: 0 }, { pageSize: 13 }, { pageSize: "20" }])(
    "falls back to the default for an invalid stored preference: %j",
    (stored) => {
      window.localStorage.setItem(STORAGE_KEYS.adminInventoryConfig, JSON.stringify(stored));
      renderLevels();
      expect(screen.getByText("Hiển thị 1–10 / 24")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Dòng mỗi trang" })).toHaveTextContent("10");
    },
  );
});
