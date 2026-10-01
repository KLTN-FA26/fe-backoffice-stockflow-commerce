import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { apiSupplier } from "../__fixtures__/supplier";
import { PERMISSION_SETS, mockApiGet, renderSupplierScreen } from "../__fixtures__/render";
import { EditSupplierPage } from "./EditSupplierPage";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./SupplierForm", () => ({
  SupplierForm: ({ existingSupplier }: { existingSupplier: { code: string } }) => (
    <div>form {existingSupplier.code}</div>
  ),
}));

const DETAIL_PATH = `/suppliers/${apiSupplier.supplierId}`;

function renderEdit(permissions: readonly PermissionCode[], handler: () => unknown) {
  const get = mockApiGet(permissions, { [DETAIL_PATH]: handler });
  renderSupplierScreen(<EditSupplierPage id={apiSupplier.supplierId} />);
  return get;
}

afterEach(() => vi.restoreAllMocks());

describe("EditSupplierPage", () => {
  it("thiếu UPDATE → 'Bạn không có quyền', không tải NCC", async () => {
    const get = renderEdit(PERMISSION_SETS.readOnly, () => apiSupplier);
    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === DETAIL_PATH)).toBe(false);
  });

  it("có UPDATE + có data → hiện form", async () => {
    renderEdit(PERMISSION_SETS.editor, () => apiSupplier);
    expect(await screen.findByText("form SUP-001")).toBeInTheDocument();
  });

  it("404 → không tìm thấy, không có nút Thử lại", async () => {
    renderEdit(PERMISSION_SETS.editor, () => {
      throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found");
    });
    expect(await screen.findByText("Không tìm thấy nhà cung cấp")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về danh sách" })).toHaveAttribute(
      "href",
      "/admin/suppliers",
    );
  });

  it("mất mạng → 'Không kết nối được máy chủ' + Thử lại tải lại", async () => {
    let calls = 0;
    renderEdit(PERMISSION_SETS.editor, () => {
      calls += 1;
      throw new ApiError(0, "NETWORK_ERROR", "offline");
    });
    expect(await screen.findByText("Không kết nối được máy chủ")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(calls).toBe(2);
  });

  it("500 → message server + traceId", async () => {
    renderEdit(PERMISSION_SETS.editor, () => {
      throw new ApiError(500, "INTERNAL_ERROR", "Lỗi hệ thống", undefined, "trace-abc");
    });
    expect(await screen.findByText("Lỗi hệ thống")).toBeInTheDocument();
    expect(screen.getByText("trace-abc")).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy nhà cung cấp")).not.toBeInTheDocument();
  });

  it("dữ liệu sai hợp đồng → 'Dữ liệu trả về không đúng định dạng'", async () => {
    renderEdit(PERMISSION_SETS.editor, () => ({ ...apiSupplier, status: "Active" }));
    expect(await screen.findByText("Dữ liệu trả về không đúng định dạng")).toBeInTheDocument();
  });
});
