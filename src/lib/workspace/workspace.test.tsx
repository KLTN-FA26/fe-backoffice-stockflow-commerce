import { render, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES } from "@/constants";
import { renderWithProviders } from "@/test/render";

import {
  prefixOfLocation,
  useWorkspaceHref,
  useWorkspaceWarehouse,
  withoutWarehouseParam,
  WorkspaceRedirect,
  WorkspaceWarehouseProvider,
} from "./index";

import type { ReactNode } from "react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const directory = vi.fn();
vi.mock("@/lib/references/warehouse-options", () => ({
  useWarehouseDirectory: () => directory(),
}));

const BD = { id: "wh-bd", prefix: "BD", name: "Kho Bình Dương" };

beforeEach(() => {
  directory.mockReturnValue({
    data: [{ warehouseId: "wh-bd", code: "BD", name: "Kho Bình Dương", active: true }],
    isError: false,
  });
});
afterEach(() => {
  replace.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("route helper của tab theo kho", () => {
  it("page(prefix, path) ghép đúng đường dẫn", () => {
    expect(ADMIN_ROUTES.warehouseMap.page("bd", "picking")).toBe("/admin/warehouse-map/bd/picking");
    expect(ADMIN_ROUTES.warehouseMap.page("BD")).toBe("/admin/warehouse-map/BD");
  });

  it("withoutWarehouseParam bỏ ?warehouse=, giữ tham số khác theo thứ tự", () => {
    expect(withoutWarehouseParam("?warehouse=x&status=OPEN&q=a")).toBe("?status=OPEN&q=a");
    expect(withoutWarehouseParam("?warehouse=x")).toBe("");
  });

  it("prefixOfLocation lấy phần trước dấu - đầu tiên, viết hoa", () => {
    expect(prefixOfLocation("bd-a01")).toBe("BD");
    expect(prefixOfLocation("HCM")).toBe("HCM");
    expect(prefixOfLocation("")).toBe("");
  });
});

describe("context kho của tab", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceWarehouseProvider value={BD}>{children}</WorkspaceWarehouseProvider>
  );

  it("ngoài provider → ném lỗi (màn vận hành không được chạy khi chưa có kho)", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useWorkspaceWarehouse())).toThrow();
  });

  it("trong provider → trả đúng kho và link theo prefix của kho", () => {
    const { result } = renderHook(
      () => ({ wh: useWorkspaceWarehouse(), href: useWorkspaceHref() }),
      {
        wrapper,
      },
    );
    expect(result.current.wh).toEqual(BD);
    expect(result.current.href("picking")).toBe("/admin/warehouse-map/BD/picking");
  });
});

describe("WorkspaceRedirect — link cũ sang route trong tab", () => {
  it("tra id kho ra prefix, giữ tham số khác ngoài ?warehouse=", async () => {
    window.history.replaceState(null, "", "/admin/picking?warehouse=wh-bd&status=OPEN");
    renderWithProviders(<WorkspaceRedirect warehouseId="wh-bd" path="picking" keepQuery />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/warehouse-map/BD/picking?status=OPEN"),
    );
  });

  it("có sẵn prefix → không cần danh mục", async () => {
    directory.mockReturnValue({ data: undefined, isError: false });
    render(<WorkspaceRedirect prefix="HCM" path="putaway/t-1" />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/warehouse-map/HCM/putaway/t-1"),
    );
  });

  it("kho không có trong danh mục → về gốc tab, không treo", async () => {
    renderWithProviders(<WorkspaceRedirect warehouseId="wh-missing" path="picking" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/warehouse-map"));
  });

  it("danh mục lỗi → về gốc tab", async () => {
    directory.mockReturnValue({ data: undefined, isError: true });
    renderWithProviders(<WorkspaceRedirect warehouseId="wh-bd" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/warehouse-map"));
  });

  it("không có kho nào để tra → về gốc tab", async () => {
    renderWithProviders(<WorkspaceRedirect warehouseId={null} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/warehouse-map"));
  });
});
