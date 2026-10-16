import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Sku } from "@/features/product";

const { useSkuMock, useIsMockMock } = vi.hoisted(() => ({
  useSkuMock: vi.fn(),
  useIsMockMock: vi.fn(() => true),
}));

vi.mock("@/providers/app-providers", () => ({ useIsMock: useIsMockMock }));

vi.mock("@/lib/auth/auth-store", () => {
  const roles: string[] = [];
  return {
    useAuthStore: (selector: (state: { effectiveRoles: () => string[] }) => unknown) =>
      selector({ effectiveRoles: () => roles }),
  };
});

vi.mock("@/features/product", async () => {
  const actual = await vi.importActual<typeof import("@/features/product")>("@/features/product");
  return {
    ...actual,
    useSku: useSkuMock,
    useProduct: () => ({ data: null, isLoading: false }),
  };
});

import { SkuDetail } from "./SkuDetail";

const sku: Sku = {
  skuId: "SKU-001-BLK-L",
  productId: "PRD-001",
  barcode: "8934567890011",
  variantLabel: "Áo Thun Cotton — Đen / L",
  attributes: { Color: "Đen", Size: "L" },
  status: "Active",
  uom: "pcs",
  price: 149000,
  cost: 62000,
  weightKg: 0.22,
  lotTracking: false,
  serialTracking: false,
  expiryTracking: false,
  stockOnHand: 240,
  stockReserved: 35,
  stockAvailable: 205,
  reorderPoint: 60,
};

async function renderSkuDetail() {
  await act(async () => {
    render(
      <Suspense fallback={<div>Loading SKU</div>}>
        <SkuDetail params={Promise.resolve({ id: sku.skuId })} />
      </Suspense>,
    );
  });
}

afterEach(() => vi.clearAllMocks());

// Procurement lives on the canonical /admin/products/{productId}/skus/{variantId} route only
// (CanonicalIdentity.test). The legacy route must not keep a second, competing integration.
describe("legacy SKU detail", () => {
  it.each([true, false])("no longer mounts Procurement (mock mode: %s)", async (mock) => {
    useIsMockMock.mockReturnValue(mock);
    useSkuMock.mockReturnValue({ data: sku, isLoading: false });
    await renderSkuDetail();

    expect((await screen.findAllByText(sku.variantLabel)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Cài đặt mua hàng" })).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa có nhà cung cấp liên kết")).not.toBeInTheDocument();
    useIsMockMock.mockReturnValue(true);
  });
});
