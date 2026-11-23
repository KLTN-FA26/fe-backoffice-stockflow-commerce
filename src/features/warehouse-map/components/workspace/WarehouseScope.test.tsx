import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/render";

import { useWorkspaceWarehouse } from "@/lib/workspace";

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
const permissionsPending = vi.fn(() => false);
vi.mock("@/lib/auth", () => ({
  useCan: () => canRead(),
  useMyPermissions: () => ({ isPending: permissionsPending() }),
}));
const navigation = vi.hoisted(() => ({ pathname: "/admin/warehouse-map/bd", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("@/features/warehouse-map/queries", () => ({
  useWarehouses: () => ({ data: { items: LIST }, isError: false, refetch: vi.fn() }),
}));

function Page() {
  const w = useWorkspaceWarehouse();
  return (
    <p>
      Bản đồ của {w.name} ({w.id} · {w.prefix})
    </p>
  );
}
const page = <Page />;

beforeEach(() => {
  canRead.mockReturnValue(true);
  permissionsPending.mockReturnValue(false);
  navigation.replace.mockReset();
  navigation.pathname = "/admin/warehouse-map/bd";
});

describe("trang của một kho theo prefix trên URL", () => {
  it("prefix chữ thường → cấp đúng kho, prefix chuẩn của danh mục, qua context", () => {
    renderWithProviders(<WarehouseScope prefix="bd">{page}</WarehouseScope>);
    expect(screen.getByText("Bản đồ của Kho Bình Dương (wh-bd · BD)")).toBeInTheDocument();
  });

  it("prefix không có trong danh mục → báo và dẫn về Danh mục kho để chọn kho", () => {
    renderWithProviders(<WarehouseScope prefix="XYZ">{page}</WarehouseScope>);
    expect(screen.getByText("Không có kho XYZ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chọn kho khác" })).toHaveAttribute(
      "href",
      "/admin/warehouses",
    );
  });

  it("prefix chữ thường trên URL → thay URL bằng prefix chuẩn, giữ phần còn lại của đường dẫn", () => {
    navigation.pathname = "/admin/warehouse-map/bd/putaway/t-1";
    renderWithProviders(<WarehouseScope prefix="bd">{page}</WarehouseScope>);
    expect(navigation.replace).toHaveBeenCalledWith("/admin/warehouse-map/BD/putaway/t-1");
  });

  it("prefix đã chuẩn → không chuyển trang", () => {
    navigation.pathname = "/admin/warehouse-map/BD";
    renderWithProviders(<WarehouseScope prefix="BD">{page}</WarehouseScope>);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("đang tải quyền → khung chờ, không nháy câu 'chưa được cấp quyền'", () => {
    canRead.mockReturnValue(false);
    permissionsPending.mockReturnValue(true);
    renderWithProviders(<WarehouseScope prefix="BD">{page}</WarehouseScope>);
    expect(screen.queryByText("Chưa được cấp quyền xem dữ liệu")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
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
