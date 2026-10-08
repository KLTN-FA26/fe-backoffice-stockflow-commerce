import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { createInventoryMockService } from "../mock-service";
import { InventoryAccess } from "./InventoryAccess";

import type { PermissionCode } from "@/lib/auth";

afterEach(() => vi.restoreAllMocks());

function renderAccess(permissions: PermissionCode[]) {
  useAuthStore.setState({
    user: {
      userId: "inventory-test",
      fullName: "Test",
      email: "test@example.com",
      roles: [],
      warehouseIds: [],
    },
    isAuthenticated: true,
  });
  vi.spyOn(api, "get").mockResolvedValue({
    data: { roles: [], permissions, dataScope: "ALL" },
  });
  const service = createInventoryMockService();
  const loadOverview = vi.spyOn(service, "loadOverview");
  const loadReservations = vi.spyOn(service, "loadReservations");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter>
        <InventoryAccess service={service} />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { loadOverview, loadReservations };
}

describe("Inventory route permissions", () => {
  const { stock, reservations } = INVENTORY_PERMISSIONS;

  it("blocks route access without stock VIEW_PAGE, even with READ", async () => {
    const service = renderAccess([stock.read]);
    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(service.loadOverview).not.toHaveBeenCalled();
  });

  it("opens the page without stock data when READ is missing", async () => {
    const service = renderAccess([stock.viewPage]);
    expect(await screen.findByText("Bạn không có quyền xem dữ liệu")).toBeInTheDocument();
    expect(screen.getByText("Tổng quan tồn kho")).toBeInTheDocument();
    expect(service.loadOverview).not.toHaveBeenCalled();
  });

  it("shows stock but does not load reservations without their own permissions", async () => {
    const service = renderAccess([stock.viewPage, stock.read]);
    expect(await screen.findByRole("region", { name: "Stock Levels" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Reservations" })).not.toBeInTheDocument();
    expect(service.loadReservations).not.toHaveBeenCalled();
  });

  it("loads reservations when both reservation permissions are granted", async () => {
    const service = renderAccess([
      stock.viewPage,
      stock.read,
      reservations.viewPage,
      reservations.read,
    ]);
    expect(await screen.findByRole("region", { name: "Reservations" })).toBeInTheDocument();
    expect(await screen.findByText("DEMO-ORDER-001")).toBeInTheDocument();
    expect(service.loadReservations).toHaveBeenCalledOnce();
  });
});
