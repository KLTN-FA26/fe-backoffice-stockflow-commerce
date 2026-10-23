import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDENTITY_PERMISSIONS } from "@/constants/permissions";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { customRole, roleFixture } from "../__fixtures__/roles";

import { RoleAdminBar } from "./RoleAdminBar";

const granted = vi.hoisted(() => ({ codes: new Set<string>() }));
vi.mock("@/lib/auth/components/Can", () => ({ useCan: (code: string) => granted.codes.has(code) }));
vi.mock("@/components/shared/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const P = IDENTITY_PERMISSIONS;
const system = roleFixture({ code: "ROLE_A", name: "Role A", holderCount: 4 });
const custom = customRole({ holderCount: 0, version: 2 });
const roles = [system, custom];

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture ??= () => false;
  granted.codes = new Set([P.rolesRead, P.rolesCreate, P.rolesUpdate, P.rolesDelete]);
});
afterEach(() => vi.restoreAllMocks());

function setup(selected = custom, onSelect = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RoleAdminBar roles={roles} selected={selected} onSelect={onSelect} />
    </QueryClientProvider>,
  );
  return { onSelect, user: userEvent.setup() };
}

describe("RoleAdminBar — gating by permission codes", () => {
  it("shows create / edit / delete for a custom role when every code is held", () => {
    setup();
    expect(screen.getByRole("button", { name: /Tạo vai trò/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đổi tên/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xoá vai trò/ })).toBeEnabled();
  });

  it.each([
    [P.rolesCreate, /Tạo vai trò/],
    [P.rolesUpdate, /Đổi tên/],
    [P.rolesDelete, /Xoá vai trò/],
  ])("hides the button that needs %s when it is missing", (code, name) => {
    granted.codes.delete(code);
    setup();
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("offers neither rename nor delete for a system role, whatever the permissions", () => {
    setup(system);
    expect(screen.getByRole("button", { name: /Tạo vai trò/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Đổi tên/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xoá vai trò/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Vai trò hệ thống/)).toBeInTheDocument();
  });

  it("disables delete while someone still holds the role and says why", () => {
    setup(customRole({ holderCount: 2 }));
    expect(screen.getByRole("button", { name: /Xoá vai trò/ })).toBeDisabled();
    expect(screen.getByText(/Còn người đang giữ vai trò này/)).toBeInTheDocument();
  });

  it("with no role codes at all it renders only the summary", () => {
    granted.codes = new Set();
    setup();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(/Phạm vi dữ liệu|Toàn bộ dữ liệu/)).toBeInTheDocument();
  });
});

describe("RoleAdminBar — create", () => {
  it("validates the code like the BE and posts the BE body, then selects the new role", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: roleFixture({ code: "NIGHT_LEAD", name: "Tổ trưởng đêm", system: false }),
    });
    const { user, onSelect } = setup();
    await user.click(screen.getByRole("button", { name: /Tạo vai trò/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText(/Mã vai trò/), "1bad code");
    await user.type(dialog.getByLabelText(/Tên vai trò/), "Tổ trưởng đêm");
    await user.click(dialog.getByRole("button", { name: "Tạo vai trò" }));
    expect(await dialog.findByText(/Mã 2–64 ký tự/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.clear(dialog.getByLabelText(/Mã vai trò/));
    await user.type(dialog.getByLabelText(/Mã vai trò/), "NIGHT_LEAD");
    await user.click(dialog.getByRole("button", { name: "Tạo vai trò" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith("/identity/roles", {
      code: "NIGHT_LEAD",
      name: "Tổ trưởng đêm",
      dataScope: "ALL",
    });
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("NIGHT_LEAD"));
  });

  it("sends the source role when copying permissions", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: roleFixture({ code: "COPY", name: "Copy", system: false }) });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Tạo vai trò/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText(/Mã vai trò/), "COPY");
    await user.type(dialog.getByLabelText(/Tên vai trò/), "Copy");
    await user.click(dialog.getByRole("combobox", { name: "Sao chép quyền từ" }));
    await user.click(await screen.findByRole("option", { name: "Role A" }));
    await user.click(dialog.getByRole("button", { name: "Tạo vai trò" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[1]).toMatchObject({ copyPermissionsFrom: "ROLE_A" });
  });

  it.each([
    ["ROLE_CODE_ALREADY_EXISTS", 409, "Mã vai trò này đã tồn tại (không phân biệt hoa thường)."],
    ["PRIVILEGE_ESCALATION", 403, /không thể cấp hoặc quản lý quyền/],
  ])("maps %s", async (code, status, message) => {
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(status, code, "English"));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Tạo vai trò/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText(/Mã vai trò/), "DUP");
    await user.type(dialog.getByLabelText(/Tên vai trò/), "Dup");
    await user.click(dialog.getByRole("button", { name: "Tạo vai trò" }));
    expect(await dialog.findByText(message)).toBeInTheDocument();
  });
});

describe("RoleAdminBar — edit and delete", () => {
  it("renames with the loaded version", async () => {
    const patch = vi
      .spyOn(api, "patch")
      .mockResolvedValue({ data: { ...custom, name: "Mới", version: 3 } });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Đổi tên/ }));
    const dialog = within(await screen.findByRole("dialog"));
    const name = dialog.getByLabelText(/Tên vai trò/);
    await user.clear(name);
    await user.type(name, "Mới");
    await user.click(dialog.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith("/identity/roles/SHIFT_LEAD", {
      name: "Mới",
      description: "",
      dataScope: "ALL",
      version: 2,
    });
  });

  it("shows SYSTEM_ROLE_IMMUTABLE / OPTIMISTIC_LOCK in Vietnamese", async () => {
    vi.spyOn(api, "patch").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "English"));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Đổi tên/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Lưu" }));
    expect(await dialog.findByText(/vừa được người khác thay đổi/)).toBeInTheDocument();
  });

  it("deletes after confirmation and selects another role", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValue({ data: null });
    const { user, onSelect } = setup();
    await user.click(screen.getByRole("button", { name: /Xoá vai trò/ }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(del).not.toHaveBeenCalled();
    await user.click(dialog.getByRole("button", { name: "Xoá vai trò" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/identity/roles/SHIFT_LEAD"));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("ROLE_A"));
  });

  it("keeps the dialog open with ROLE_IN_USE when the BE refuses", async () => {
    vi.spyOn(api, "delete").mockRejectedValue(new ApiError(409, "ROLE_IN_USE", "English"));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Xoá vai trò/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Xoá vai trò" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent(/vẫn đang được gán cho người dùng/);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
