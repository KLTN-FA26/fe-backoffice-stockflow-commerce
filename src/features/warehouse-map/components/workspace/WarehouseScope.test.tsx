import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/render";

import { prefixFromPath } from "@/features/warehouse-map/workspace";

import { WarehouseScope } from "./WarehouseScope";

import type { Warehouse } from "@/features/warehouse-map/types";

const warehouse = (id: string, prefix: string, name: string): Warehouse => ({
  id,
  prefix,
  name,
  address: "12 Đường Demo",
  mapUnit: "M",
  mapWidth: 60,
  mapHeight: 40,
  status: "ACTIVE",
  version: 0,
});
const LIST = [
  warehouse("wh-hcm", "HCM", "Kho Hồ Chí Minh"),
  warehouse("wh-bd", "BD", "Kho Bình Dương"),
];

const canRead = vi.fn(() => true);
vi.mock("@/lib/auth", () => ({ useCan: () => canRead() }));
vi.mock("@/features/warehouse-map/queries", () => ({
  useWarehouses: () => ({ data: { items: LIST }, isError: false, refetch: vi.fn() }),
}));

const page = (w: Warehouse) => <p>Bản đồ của {w.name}</p>;

beforeEach(() => canRead.mockReturnValue(true));

describe("trang của một kho theo prefix trên URL", () => {
  it("prefix → đúng kho (không phân biệt hoa thường)", () => {
    renderWithProviders(<WarehouseScope prefix="bd">{page}</WarehouseScope>);
    expect(screen.getByText("Bản đồ của Kho Bình Dương")).toBeInTheDocument();
  });

  it("prefix không có trong danh mục → báo và dẫn về Danh mục kho để chọn kho", () => {
    renderWithProviders(<WarehouseScope prefix="XYZ">{page}</WarehouseScope>);
    expect(screen.getByText("Không có kho XYZ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chọn kho khác" })).toHaveAttribute(
      "href",
      "/admin/warehouses",
    );
  });

  it("thiếu quyền đọc danh mục kho → không mở trang của kho", () => {
    canRead.mockReturnValue(false);
    renderWithProviders(<WarehouseScope prefix="HCM">{page}</WarehouseScope>);
    expect(screen.queryByText(/Bản đồ của/)).not.toBeInTheDocument();
    expect(screen.getByText("Chưa được cấp quyền xem dữ liệu")).toBeInTheDocument();
  });

  it("đọc prefix từ đường dẫn của tab", () => {
    expect(prefixFromPath("/admin/warehouse-map/BD/slotting", "/admin/warehouse-map")).toBe("BD");
    expect(prefixFromPath("/admin/warehouse-map", "/admin/warehouse-map")).toBeNull();
  });
});
