import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { PERMISSION_SETS, renderIdentityScreen, stubIdentityApi } from "../__fixtures__/render";
import { rawRoles, userFixture, userPage } from "../__fixtures__/users";

import { UserListPage } from "./UserListPage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(() => vi.restoreAllMocks());

let currentClient: ReturnType<typeof renderIdentityScreen>["client"];

async function openDialog(permissions = PERMISSION_SETS.full, routes = {}) {
  const api = stubIdentityApi(permissions, {
    "GET /identity/users": () => userPage([userFixture()]),
    ...routes,
  });
  currentClient = renderIdentityScreen(<UserListPage />).client;
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Thêm người dùng/ }));
  const dialog = await screen.findByRole("dialog");
  // chờ danh mục vai trò tải xong
  await within(dialog).findByRole("checkbox", { name: "Role A" });
  return { api, user, dialog: within(dialog) };
}

describe("CreateUserDialog", () => {
  it("validates on the client the same way the BE does and does not call the API", async () => {
    const { api, user, dialog } = await openDialog();
    await user.type(dialog.getByLabelText(/Tên đăng nhập/), "a b");
    await user.type(dialog.getByLabelText(/^Email/), "khong-hop-le");
    await user.type(dialog.getByLabelText(/Mật khẩu ban đầu/), "yeu");
    await user.click(dialog.getByRole("button", { name: "Tạo tài khoản" }));
    expect(await dialog.findByText(/Tên đăng nhập 3–100 ký tự/)).toBeInTheDocument();
    expect(dialog.getByText("Email không hợp lệ.")).toBeInTheDocument();
    expect(dialog.getByText(/Mật khẩu 10–72 ký tự/)).toBeInTheDocument();
    expect(dialog.getByText("Chọn ít nhất một vai trò.")).toBeInTheDocument();
    expect(api.of("post", "/identity/users")).toHaveLength(0);
  });

  it("posts the BE body, then shows a generated password exactly once", async () => {
    const created = userFixture({ username: "new.staff", mustChangePassword: true });
    const { api, user, dialog } = await openDialog(PERMISSION_SETS.full, {
      "POST /identity/users": () => ({ user: created, temporaryPassword: "Gen3rated9Pw" }),
    });
    await user.type(dialog.getByLabelText(/Tên đăng nhập/), "new.staff");
    await user.type(dialog.getByLabelText(/^Email/), "new@stockflow.vn");
    await user.click(dialog.getByRole("checkbox", { name: "Role A" }));
    await user.click(dialog.getByRole("checkbox", { name: "Kho Hà Nội" }));
    await user.click(dialog.getByRole("button", { name: "Tạo tài khoản" }));

    await waitFor(() => expect(api.of("post", "/identity/users")).toHaveLength(1));
    expect(api.of("post", "/identity/users")[0]?.body).toEqual({
      username: "new.staff",
      email: "new@stockflow.vn",
      roles: ["ROLE_A"],
      warehouseIds: ["WH-HN"],
    });
    expect(await screen.findByText("Gen3rated9Pw")).toBeInTheDocument();
    expect(screen.getByText(/hệ thống sẽ không hiển thị lại/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Đã lưu lại, đóng" }));
    await waitFor(() => expect(screen.queryByText("Gen3rated9Pw")).not.toBeInTheDocument());
  });

  it("does not keep the typed or the generated password in the react-query MutationCache", async () => {
    const { user, dialog } = await openDialog(PERMISSION_SETS.full, {
      "POST /identity/users": () => ({ user: userFixture(), temporaryPassword: "Gen3rated9Pw" }),
    });
    await user.type(dialog.getByLabelText(/Tên đăng nhập/), "secret.user");
    await user.type(dialog.getByLabelText(/^Email/), "s@stockflow.vn");
    await user.type(dialog.getByLabelText(/Mật khẩu ban đầu/), "Typed1Passw0rd");
    await user.click(dialog.getByRole("checkbox", { name: "Role A" }));
    await user.click(dialog.getByRole("button", { name: "Tạo tài khoản" }));
    // the one-time password is on screen (component state) ...
    expect(await screen.findByText("Gen3rated9Pw")).toBeInTheDocument();
    // ... but neither it nor the typed one lives in the cache, even before the dialog is closed
    const dump = () =>
      JSON.stringify(
        currentClient
          .getMutationCache()
          .getAll()
          .map((m) => [m.state.variables, m.state.data]),
      );
    expect(dump()).not.toContain("Gen3rated9Pw");
    expect(dump()).not.toContain("Typed1Passw0rd");
    await user.click(screen.getByRole("button", { name: "Đã lưu lại, đóng" }));
    await waitFor(() => expect(screen.queryByText("Gen3rated9Pw")).not.toBeInTheDocument());
    expect(dump()).not.toContain("Gen3rated9Pw");
    expect(dump()).not.toContain("Typed1Passw0rd");
  });

  it("sends a chosen password and shows no temporary-password dialog", async () => {
    const { api, user, dialog } = await openDialog(PERMISSION_SETS.full, {
      "POST /identity/users": () => ({ user: userFixture() }),
    });
    await user.type(dialog.getByLabelText(/Tên đăng nhập/), "chosen.pw");
    await user.type(dialog.getByLabelText(/^Email/), "c@stockflow.vn");
    await user.type(dialog.getByLabelText(/Mật khẩu ban đầu/), "Abcdefghi1");
    await user.click(dialog.getByRole("checkbox", { name: "Role A" }));
    await user.click(dialog.getByRole("button", { name: "Tạo tài khoản" }));
    await waitFor(() => expect(api.of("post", "/identity/users")).toHaveLength(1));
    expect(api.of("post", "/identity/users")[0]?.body).toMatchObject({ password: "Abcdefghi1" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText(/hệ thống sẽ không hiển thị lại/)).not.toBeInTheDocument();
  });

  it("puts a duplicate username on the username field", async () => {
    const { user, dialog } = await openDialog(PERMISSION_SETS.full, {
      "POST /identity/users": () => {
        throw new ApiError(
          409,
          "USERNAME_ALREADY_EXISTS",
          "An account with this username already exists",
        );
      },
    });
    await user.type(dialog.getByLabelText(/Tên đăng nhập/), "lan.nguyen");
    await user.type(dialog.getByLabelText(/^Email/), "x@stockflow.vn");
    await user.click(dialog.getByRole("checkbox", { name: "Role A" }));
    await user.click(dialog.getByRole("button", { name: "Tạo tài khoản" }));
    expect(
      await dialog.findByText("Tên đăng nhập này đã tồn tại (không phân biệt hoa thường)."),
    ).toBeInTheDocument();
    expect(dialog.getByLabelText(/Tên đăng nhập/)).toBeInvalid();
  });

  it.each([
    ["USER_EMAIL_ALREADY_EXISTS", 409, "Email này đã được dùng cho một tài khoản khác."],
    [
      "PRIVILEGE_ESCALATION",
      403,
      "Bạn không thể cấp hoặc quản lý quyền mà chính tài khoản của bạn không có. Hãy nhờ quản trị viên có đủ quyền thực hiện.",
    ],
    [
      "ROLE_NOT_ASSIGNABLE",
      409,
      "Vai trò này không thể gán cho tài khoản này (vai trò khách hàng chỉ dành cho tài khoản khách hàng).",
    ],
  ])("shows %s in Vietnamese", async (code, status, message) => {
    const { user, dialog } = await openDialog(PERMISSION_SETS.full, {
      "POST /identity/users": () => {
        throw new ApiError(status, code, "English");
      },
    });
    await user.type(dialog.getByLabelText(/Tên đăng nhập/), "someone");
    await user.type(dialog.getByLabelText(/^Email/), "x@stockflow.vn");
    await user.click(dialog.getByRole("checkbox", { name: "Role A" }));
    await user.click(dialog.getByRole("button", { name: "Tạo tài khoản" }));
    expect(await dialog.findByText(message)).toBeInTheDocument();
  });

  it("does not offer the customer role: the BE always refuses it for staff accounts", async () => {
    const { dialog } = await openDialog(PERMISSION_SETS.full, {
      "GET /identity/roles": () => [
        ...rawRoles,
        {
          code: "CUSTOMER",
          name: "Customer",
          system: true,
          version: 0,
          holderCount: 9,
          dataScope: "OWN",
          createdAt: "2026-09-03T00:00:00Z",
        },
      ],
    });
    expect(dialog.getByRole("checkbox", { name: "Role A" })).toBeInTheDocument();
    expect(dialog.queryByRole("checkbox", { name: "Customer" })).not.toBeInTheDocument();
  });

  it("warns when a warehouse-scoped role is picked without any warehouse", async () => {
    const { user, dialog } = await openDialog();
    await user.click(dialog.getByRole("checkbox", { name: "Role B" }));
    expect(dialog.getByRole("status")).toHaveTextContent(/chưa gán kho/);
    await user.click(dialog.getByRole("checkbox", { name: "Kho TP.HCM" }));
    expect(dialog.queryByRole("status")).not.toBeInTheDocument();
  });

  it("cannot be submitted without the role catalog and explains why", async () => {
    stubIdentityApi(PERMISSION_SETS.noRolesRead, {
      "GET /identity/users": () => userPage([userFixture()]),
    });
    renderIdentityScreen(<UserListPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Thêm người dùng/ }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/không có quyền xem danh sách vai trò/)).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Tạo tài khoản" })).toBeDisabled();
  });

  it("hides the warehouse picker without warehouse read permission", async () => {
    stubIdentityApi(PERMISSION_SETS.noWarehouseRead, {
      "GET /identity/users": () => userPage([userFixture()]),
    });
    renderIdentityScreen(<UserListPage />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /Thêm người dùng/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await dialog.findByRole("checkbox", { name: "Role A" });
    expect(dialog.queryByText("Kho làm việc")).not.toBeInTheDocument();
  });
});
