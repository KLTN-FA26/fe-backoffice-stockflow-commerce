import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/render";

import { WarehouseCrumb } from "./WarehouseCrumb";

import type { AssignedWarehouses } from "@/lib/auth";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/warehouse-map/BD/slotting" }));
vi.mock("@/features/warehouse-map/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/warehouse-map/workspace")>()),
  useWorkspaceWarehouses: () => ({
    warehouses: [
      { id: "wh-bd", prefix: "BD", name: "Kho Bình Dương" },
      { id: "wh-hcm", prefix: "HCM", name: "Kho Hồ Chí Minh" },
    ],
  }),
}));
const assigned = vi.fn<() => AssignedWarehouses & { isLoading: boolean }>();
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useAssignedWarehouses: () => assigned(),
}));

describe("đổi kho trên breadcrumb", () => {
  it("restricted: vẫn liệt kê mọi kho, kho không được gán có nhãn (bản đồ mở được — 06)", async () => {
    assigned.mockReturnValue({
      scope: "restricted",
      warehouses: [{ id: "wh-bd", prefix: "BD" }],
      isLoading: false,
    });
    renderWithProviders(<WarehouseCrumb />);
    await userEvent.click(screen.getByRole("button", { name: /Đổi kho/ }));
    const hcm = screen.getByRole("link", { name: /HCM/ });
    expect(hcm).toHaveTextContent("Không được gán");
    expect(screen.getByRole("link", { name: /BD/ })).not.toHaveTextContent("Không được gán");
  });
});
