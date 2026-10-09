import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SkuDetailPanel } from "./SkuDetailPanel";

import type { Sku } from "@/lib/mock-data";

const sku: Sku = {
  skuId: "sku-fixture",
  productId: "product-fixture",
  barcode: "",
  variantLabel: "Test SKU",
  attributes: {},
  status: "Active",
  uom: "pcs",
  price: 0,
  cost: 0,
  weightKg: 0,
  lotTracking: false,
  serialTracking: false,
  expiryTracking: false,
  stockOnHand: 0,
  stockReserved: 0,
  stockAvailable: 0,
  reorderPoint: 0,
};
afterEach(cleanup);
describe("inline SKU permission gate", () => {
  it("defaults to read-only when no resolved UPDATE permission is supplied", () => {
    render(<SkuDetailPanel sku={sku} open onClose={vi.fn()} onStatusChange={vi.fn()} />);
    expect(screen.getByText(sku.variantLabel)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Khoá SKU" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ngừng sử dụng" })).not.toBeInTheDocument();
  });
  it("a resolved UPDATE grant exposes the already-declared status actions", async () => {
    const onStatusChange = vi.fn();
    render(
      <SkuDetailPanel sku={sku} open canUpdate onClose={vi.fn()} onStatusChange={onStatusChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Khoá SKU" }));
    expect(onStatusChange).toHaveBeenCalledWith(sku.skuId, "Blocked");
  });
});
