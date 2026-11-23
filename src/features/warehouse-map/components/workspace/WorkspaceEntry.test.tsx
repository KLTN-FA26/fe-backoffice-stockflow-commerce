import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/render";

import { WorkspaceEntry } from "./WorkspaceEntry";

import type { AssignedWarehouses } from "@/lib/auth";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const assigned = vi.fn<() => AssignedWarehouses & { isLoading: boolean }>();
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useAssignedWarehouses: () => assigned(),
}));

afterEach(() => replace.mockReset());

describe("vào tab Kho theo kho được gán (spec §5.3)", () => {
  it("được gán đúng một kho → vào thẳng kho đó", async () => {
    assigned.mockReturnValue({
      scope: "restricted",
      warehouses: [{ id: "wh-bd", prefix: "BD" }],
      isLoading: false,
    });
    renderWithProviders(<WorkspaceEntry />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/warehouse-map/BD"));
  });

  it("chưa được gán kho nào → báo liên hệ quản trị, không chuyển trang", () => {
    assigned.mockReturnValue({ scope: "restricted", warehouses: [], isLoading: false });
    renderWithProviders(<WorkspaceEntry />);
    expect(
      screen.getByText("Bạn chưa được gán kho nào — liên hệ quản trị viên"),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("được gán nhiều kho → Danh mục kho để chọn", async () => {
    assigned.mockReturnValue({
      scope: "restricted",
      warehouses: [
        { id: "wh-bd", prefix: "BD" },
        { id: "wh-hcm", prefix: "HCM" },
      ],
      isLoading: false,
    });
    renderWithProviders(<WorkspaceEntry />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/warehouses"));
  });

  it.each(["all", "unknown"] as const)("phạm vi %s → Danh mục kho", async (scope) => {
    assigned.mockReturnValue({ scope, warehouses: [], isLoading: false });
    renderWithProviders(<WorkspaceEntry />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/warehouses"));
  });

  it("đang tải quyền → chưa chuyển trang", () => {
    assigned.mockReturnValue({ scope: "unknown", warehouses: [], isLoading: true });
    renderWithProviders(<WorkspaceEntry />);
    expect(replace).not.toHaveBeenCalled();
  });
});
