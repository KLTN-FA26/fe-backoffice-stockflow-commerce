import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { MOVE_LABELS } from "@/constants/move";

import { StockRowPicker } from "./StockRowPicker";

import type { StockRow } from "../types";

const visible: StockRow = {
  id: crypto.randomUUID(),
  sku: "CUP-PP-500",
  locationCode: "HCM-A01-1-A",
  onHand: 10,
  reserved: 4,
  available: 6,
  hiddenDuringCount: false,
  status: "AVAILABLE",
};
const hidden: StockRow = {
  id: crypto.randomUUID(),
  sku: "CUP-PP-500",
  locationCode: "HCM-A01-1-B",
  hiddenDuringCount: true,
  status: "AVAILABLE",
};

afterEach(cleanup);

function rowOf(location: string) {
  const row = screen.getByText(location).closest("tr");
  if (!row) throw new Error(`no row for ${location}`);
  return within(row);
}

describe("StockRowPicker with a slot hidden during a count", () => {
  it("shows the badge instead of numbers and cannot pick the hidden slot as a source", async () => {
    const onPick = vi.fn();
    render(<StockRowPicker rows={[visible, hidden]} selectedId={undefined} onPick={onPick} />);

    expect(rowOf("HCM-A01-1-A").getByText("6")).toBeInTheDocument();
    expect(rowOf("HCM-A01-1-A").queryByTestId("hidden-during-count")).toBeNull();

    const hiddenRow = rowOf("HCM-A01-1-B");
    expect(hiddenRow.getByText(INVENTORY_LABELS.hiddenDuringCount)).toBeInTheDocument();
    const pick = hiddenRow.getByRole("button", { name: MOVE_LABELS.stockPick });
    expect(pick).toBeDisabled();
    expect(pick).toHaveAttribute("title", MOVE_LABELS.stockHiddenSource);
    await userEvent.click(pick);
    expect(onPick).not.toHaveBeenCalled();

    await userEvent.click(
      rowOf("HCM-A01-1-A").getByRole("button", { name: MOVE_LABELS.stockPick }),
    );
    expect(onPick).toHaveBeenCalledWith(visible);
  });
});
