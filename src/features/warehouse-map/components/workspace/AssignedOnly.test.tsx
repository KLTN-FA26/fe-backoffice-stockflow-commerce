import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceWarehouseProvider } from "@/lib/workspace";
import { renderWithProviders } from "@/test/render";

import { AssignedOnly } from "./AssignedOnly";

import type { AssignedWarehouses } from "@/lib/auth";

const assigned = vi.fn<() => AssignedWarehouses & { isLoading: boolean }>();
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useAssignedWarehouses: () => assigned(),
}));

const HCM = { id: "wh-hcm", prefix: "HCM", name: "Kho Hồ Chí Minh" };
const restricted = (...prefixes: string[]) => ({
  scope: "restricted" as const,
  warehouses: prefixes.map((prefix) => ({ id: `wh-${prefix.toLowerCase()}`, prefix })),
  isLoading: false,
});

const rendered = vi.fn();
function Screen() {
  rendered();
  return <p>Màn vận hành</p>;
}
const ui = () => (
  <WorkspaceWarehouseProvider value={HCM}>
    <AssignedOnly>
      <Screen />
    </AssignedOnly>
  </WorkspaceWarehouseProvider>
);

beforeEach(() => rendered.mockClear());

describe("màn vận hành chỉ mở ở kho được gán (docs 05/07/08/11/20; bản đồ không chặn — 06)", () => {
  it("kho không được gán → báo, dẫn sang bản đồ của kho đó, không render màn (không gọi API)", () => {
    assigned.mockReturnValue(restricted("BD"));
    renderWithProviders(ui());
    expect(screen.getByText("Bạn không được gán kho này")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở bản đồ kho" })).toHaveAttribute(
      "href",
      "/admin/warehouse-map/HCM",
    );
    expect(rendered).not.toHaveBeenCalled();
  });

  it("kho được gán → render màn", () => {
    assigned.mockReturnValue(restricted("HCM"));
    renderWithProviders(ui());
    expect(screen.getByText("Màn vận hành")).toBeInTheDocument();
  });

  it.each(["all", "unknown"] as const)("phạm vi %s → render màn (BE vẫn re-check)", (scope) => {
    assigned.mockReturnValue({ scope, warehouses: [], isLoading: false });
    renderWithProviders(ui());
    expect(screen.getByText("Màn vận hành")).toBeInTheDocument();
  });

  it("quyền đổi giữa phiên (gỡ kho đang mở) → chuyển sang thông báo", () => {
    assigned.mockReturnValue(restricted("BD", "HCM"));
    const view = renderWithProviders(ui());
    expect(screen.getByText("Màn vận hành")).toBeInTheDocument();
    assigned.mockReturnValue(restricted("BD"));
    view.rerender(ui());
    expect(screen.queryByText("Màn vận hành")).not.toBeInTheDocument();
    expect(screen.getByText("Bạn không được gán kho này")).toBeInTheDocument();
  });

  it("đang tải quyền → khung chờ, chưa render màn", () => {
    assigned.mockReturnValue({ scope: "unknown", warehouses: [], isLoading: true });
    renderWithProviders(ui());
    expect(rendered).not.toHaveBeenCalled();
  });
});
