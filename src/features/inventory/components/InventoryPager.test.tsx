import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_LABELS } from "@/constants/inventory";

import { adjustmentFixture } from "../test-support";
import { InventoryPager } from "./InventoryPager";

import type { InventoryPageMeta } from "./InventoryPager";
import type { AdjustmentPage, MovementPage, WarehouseStockItemPage } from "../types";

afterEach(cleanup);

const meta = { size: 15, totalElements: 31, totalPages: 3, hasNext: true, hasPrevious: true };
const movementPage: MovementPage = { ...meta, page: 1, items: [] };
const adjustmentPage: AdjustmentPage = {
  ...meta,
  page: 1,
  items: Array.from({ length: 15 }, () => adjustmentFixture()),
};
const overviewPage: WarehouseStockItemPage = {
  ...meta,
  page: 1,
  items: Array.from({ length: 15 }, (_, index) => ({
    stockItemId: crypto.randomUUID(),
    sku: "CUP-PP-500",
    locationCode: `HN01-A01-${index}`,
    onHand: 1,
    reserved: 0,
    available: 1,
    status: "AVAILABLE",
  })),
};

function renderPager(data: InventoryPageMeta, id?: string) {
  const setPage = vi.fn();
  const setSize = vi.fn();
  render(
    <InventoryPager
      data={data}
      id={id}
      pending={false}
      size={15}
      setPage={setPage}
      setSize={setSize}
    />,
  );
  return { setPage, setSize };
}

describe("InventoryPager", () => {
  it.each([
    ["movement", movementPage],
    ["adjustment", adjustmentPage],
    ["overview stock item", overviewPage],
  ] as const)("keeps the one-based page callbacks for a %s page", async (_, data) => {
    const user = userEvent.setup();
    const { setPage, setSize } = renderPager(data);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: INVENTORY_LABELS.previous }));
    await user.click(screen.getByRole("button", { name: INVENTORY_LABELS.next }));
    // Backend page 1 (zero-based) is UI page 2: previous → 1, next → 3.
    expect(setPage.mock.calls).toEqual([[1], [3]]);
    await user.selectOptions(screen.getByLabelText(INVENTORY_LABELS.perPage), "50");
    expect(setSize).toHaveBeenCalledWith(50);
  });

  it("shows the item range of the current page", () => {
    renderPager(adjustmentPage);
    expect(screen.getByText(`${INVENTORY_LABELS.showing} 16–30 / 31`)).toBeInTheDocument();
  });

  it("disables the ends of the range", () => {
    renderPager({ ...movementPage, page: 0, hasPrevious: false, hasNext: false, totalPages: 1 });
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.previous })).toBeDisabled();
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.next })).toBeDisabled();
  });

  it("pairs the label with its own select when an id is given", () => {
    renderPager(movementPage, "custom-page-size");
    expect(screen.getByLabelText(INVENTORY_LABELS.perPage)).toHaveAttribute(
      "id",
      "custom-page-size",
    );
  });
});

it("gives simultaneous default pagers distinct label/select associations", () => {
  renderPager(movementPage);
  renderPager(adjustmentPage);
  const selects = screen.getAllByLabelText(INVENTORY_LABELS.perPage);
  expect(selects).toHaveLength(2);
  expect(selects[0]?.id).toBeTruthy();
  expect(selects[0]?.id).not.toBe(selects[1]?.id);
});

it("disables page size and navigation while pending", () => {
  render(
    <InventoryPager data={adjustmentPage} pending size={15} setPage={vi.fn()} setSize={vi.fn()} />,
  );
  expect(screen.getByLabelText(INVENTORY_LABELS.perPage)).toBeDisabled();
  for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
});
