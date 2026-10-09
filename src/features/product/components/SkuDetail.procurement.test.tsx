import { Suspense } from "react";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES } from "@/constants";

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

describe("SKU detail procurement navigation", () => {
  it("renders settings on the SKU route with links to existing supplier detail routes", async () => {
    useSkuMock.mockReturnValue({ data: sku, isLoading: false });
    await renderSkuDetail();

    expect(await screen.findByRole("heading", { name: "Cài đặt mua hàng" })).toBeInTheDocument();
    expect(useSkuMock).toHaveBeenCalledWith(sku.skuId);
    expect(screen.getByRole("link", { name: "Công ty TNHH Dệt may Thành Công" })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.suppliers.detail("SUP-001"),
    );
  });

  it("keeps illustrative mappings and the legacy reorder point out of non-mock settings", async () => {
    useIsMockMock.mockReturnValue(false);
    useSkuMock.mockReturnValue({ data: sku, isLoading: false });
    await renderSkuDetail();

    expect(await screen.findByRole("heading", { name: "Cài đặt mua hàng" })).toBeInTheDocument();
    expect(screen.getByText("Chưa có nhà cung cấp liên kết")).toBeInTheDocument();
    const settings = within(screen.getByRole("region", { name: "Cài đặt mua hàng" }));
    expect(settings.queryByText(String(sku.reorderPoint))).not.toBeInTheDocument();
    expect(settings.getAllByText("Chưa có dữ liệu")).toHaveLength(2);
    expect(
      screen.queryByRole("link", { name: "Công ty TNHH Dệt may Thành Công" }),
    ).not.toBeInTheDocument();
    useIsMockMock.mockReturnValue(true);
  });
});
