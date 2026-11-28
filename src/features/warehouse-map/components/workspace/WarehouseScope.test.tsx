import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/render";

import { useAppStore } from "@/lib/store/use-app-store";
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
const ALL = [
  warehouse("wh-hcm", "HCM", "Kho Hồ Chí Minh"),
  warehouse("wh-bd", "BD", "Kho Bình Dương"),
];
const catalog = vi.hoisted(() => ({ items: [] as Warehouse[] }));

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
  useWarehouses: () => ({ data: { items: catalog.items }, isError: false, refetch: vi.fn() }),
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
  catalog.items = ALL;
  canRead.mockReturnValue(true);
  permissionsPending.mockReturnValue(false);
  navigation.replace.mockReset();
  navigation.pathname = "/admin/warehouse-map/bd";
  useAppStore.setState({ workspacePrefix: null });
});

describe("trang của một kho theo prefix trên URL", () => {
  it("prefix chữ thường → cấp đúng kho, prefix chuẩn của danh mục, qua context", () => {
    renderWithProviders(<WarehouseScope prefix="bd">{page}</WarehouseScope>);
    expect(screen.getByText("Bản đồ của Kho Bình Dương (wh-bd · BD)")).toBeInTheDocument();
  });

  it("vào kho → nhớ prefix chuẩn để panel sidebar giữ kho khi sang Danh mục kho / Sức chứa kho", () => {
    renderWithProviders(<WarehouseScope prefix="bd">{page}</WarehouseScope>);
    expect(useAppStore.getState().workspacePrefix).toBe("BD");
  });

  it("prefix không có trong danh mục → không ghi đè kho đang nhớ", () => {
    useAppStore.setState({ workspacePrefix: "HCM" });
    renderWithProviders(<WarehouseScope prefix="XYZ">{page}</WarehouseScope>);
    expect(useAppStore.getState().workspacePrefix).toBe("HCM");
  });

  it("prefix không có trong danh mục → báo và dẫn về Danh mục kho để chọn kho", () => {
    renderWithProviders(<WarehouseScope prefix="XYZ">{page}</WarehouseScope>);
    expect(screen.getByText("Không có kho XYZ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chọn kho khác" })).toHaveAttribute(
      "href",
      "/admin/warehouses",
    );
  });

  it("kho trên URL không có mà có nhiều kho → liệt kê các kho, mỗi link giữ nguyên trang đang mở (S12-7)", () => {
    navigation.pathname = "/admin/warehouse-map/HAN/putaway/t-1";
    renderWithProviders(<WarehouseScope prefix="HAN">{page}</WarehouseScope>);
    expect(screen.getByText("Không có kho HAN")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /BD · Kho Bình Dương/ })).toHaveAttribute(
      "href",
      "/admin/warehouse-map/BD/putaway/t-1",
    );
    expect(screen.getByRole("link", { name: /HCM · Kho Hồ Chí Minh/ })).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("kho trên URL không có mà chỉ có một kho → tự chuyển sang kho đó, giữ trang", () => {
    navigation.pathname = "/admin/warehouse-map/HAN/receiving";
    catalog.items = [warehouse("wh-bd", "BD", "Kho Bình Dương")];
    renderWithProviders(<WarehouseScope prefix="HAN">{page}</WarehouseScope>);
    expect(navigation.replace).toHaveBeenCalledWith("/admin/warehouse-map/BD/receiving");
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
