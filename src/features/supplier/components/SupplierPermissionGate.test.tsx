import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { renderSupplierScreen } from "../__fixtures__/render";
import { SupplierPermissionGate } from "./SupplierPermissionGate";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

describe("SupplierPermissionGate — BE chưa có /identity/me/permissions (404)", () => {
  it("không gọi lại liên tục: chỉ 1 request, hiện lỗi tải quyền (không phải 'không tìm thấy NCC')", async () => {
    const get = vi.spyOn(api, "get").mockImplementation(async () => {
      throw new ApiError(404, "HTTP_404", "Not Found");
    });

    renderSupplierScreen(
      <SupplierPermissionGate permissions={["procurement-suppliers:VIEW_PAGE"]}>
        <div>nội dung</div>
      </SupplierPermissionGate>,
    );

    expect(await screen.findByText("Không tải được quyền truy cập")).toBeInTheDocument();
    // Chờ thêm để chắc không còn vòng mount → refetch → unmount
    await new Promise((r) => setTimeout(r, 300));
    expect(get).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Không tìm thấy nhà cung cấp")).not.toBeInTheDocument();
    expect(screen.queryByText("nội dung")).not.toBeInTheDocument();
  });
});
