import { onlineManager } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { apiSupplier } from "../__fixtures__/supplier";
import { PERMISSION_SETS, mockApiGet, renderSupplierScreen } from "../__fixtures__/render";
import { SupplierDetail } from "./SupplierDetail";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL_PATH = `/suppliers/${apiSupplier.supplierId}`;

function renderDetail(permissions: readonly PermissionCode[], handler: () => unknown) {
  mockApiGet(permissions, { [DETAIL_PATH]: handler });
  return renderSupplierScreen(<SupplierDetail id={apiSupplier.supplierId} />);
}

afterEach(() => {
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe("SupplierDetail — action-gating theo mã quyền", () => {
  it("chỉ READ → xem được, không có nút Chỉnh sửa / Ngừng hợp tác", async () => {
    renderDetail(PERMISSION_SETS.readOnly, () => apiSupplier);

    expect(await screen.findByRole("heading", { name: apiSupplier.name })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Chỉnh sửa hồ sơ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ngừng hợp tác/ })).not.toBeInTheDocument();
    expect(screen.getByText("Bạn chỉ có quyền xem nhà cung cấp.")).toBeInTheDocument();
  });

  it("UPDATE (không DELETE) → có Chỉnh sửa, không có Ngừng hợp tác", async () => {
    renderDetail(PERMISSION_SETS.editor, () => apiSupplier);

    expect(await screen.findByRole("link", { name: /Chỉnh sửa hồ sơ/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ngừng hợp tác/ })).not.toBeInTheDocument();
  });

  it("có DELETE → có Ngừng hợp tác", async () => {
    renderDetail(PERMISSION_SETS.full, () => apiSupplier);
    expect(await screen.findByRole("button", { name: /Ngừng hợp tác/ })).toBeInTheDocument();
  });

  it("vòng đời hiện nhãn tiếng Việt, không hiện Active/Inactive", async () => {
    renderDetail(PERMISSION_SETS.readOnly, () => apiSupplier);
    await screen.findByRole("heading", { name: apiSupplier.name });
    expect(screen.getAllByText("Hoạt động").length).toBeGreaterThan(0);
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
  });

  it("link PO lọc theo NCC", async () => {
    renderDetail(PERMISSION_SETS.readOnly, () => apiSupplier);
    const link = await screen.findByRole("link", { name: /Xem đơn đặt hàng của nhà cung cấp này/ });
    expect(link).toHaveAttribute(
      "href",
      `/admin/purchase-orders?supplierId=${apiSupplier.supplierId}`,
    );
  });
});

describe("SupplierDetail — chỉ 404 mới là 'không tìm thấy'", () => {
  it("404 → không tìm thấy", async () => {
    renderDetail(PERMISSION_SETS.readOnly, () => {
      throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found");
    });
    expect(await screen.findByText("Không tìm thấy nhà cung cấp")).toBeInTheDocument();
  });

  it("mất mạng (query bị pause) → 'Không kết nối được máy chủ', không phải 'không tìm thấy'", async () => {
    onlineManager.setOnline(false);
    renderDetail(PERMISSION_SETS.readOnly, () => apiSupplier);

    expect(await screen.findByText("Không kết nối được máy chủ")).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy nhà cung cấp")).not.toBeInTheDocument();
  });
});
