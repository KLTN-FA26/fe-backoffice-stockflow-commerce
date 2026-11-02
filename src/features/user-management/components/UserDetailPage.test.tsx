import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { PERMISSION_SETS, renderIdentityScreen, stubIdentityApi } from "../__fixtures__/render";
import { rawRoles, userFixture } from "../__fixtures__/users";

import { UserDetailPage } from "./UserDetailPage";

import type { PermissionCode } from "@/lib/auth";
import type { Handler } from "../__fixtures__/render";
import type { UserDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/shared/Toast", () => ({ toast }));

afterEach(() => vi.restoreAllMocks());

const ID = "11111111-1111-4111-8111-111111111111";
const url = `/identity/users/${ID}`;

function setup(
  user: Partial<UserDto> = {},
  permissions: readonly PermissionCode[] = PERMISSION_SETS.editor,
  routes: Record<string, Handler> = {},
  viewerId = "u-admin",
) {
  const api = stubIdentityApi(permissions, { [`GET ${url}`]: () => userFixture(user), ...routes });
  const { client } = renderIdentityScreen(<UserDetailPage id={ID} />, "", viewerId);
  return { api, user: userEvent.setup(), client };
}

describe("UserDetailPage — gating by permission codes", () => {
  it("READ only → profile is read-only and no action buttons exist", async () => {
    setup({}, PERMISSION_SETS.readOnly);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Nguyễn Thị Lan" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Nguyễn Thị Lan" })).toBeInTheDocument();
    expect(screen.getByLabelText("Họ tên")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Khoá tài khoản" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đặt lại mật khẩu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gán vai trò" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu kho" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gỡ vai trò/ })).not.toBeInTheDocument();
  });

  it("UPDATE → actions appear", async () => {
    setup();
    expect(await screen.findByRole("button", { name: "Khoá tài khoản" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vô hiệu hoá" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đặt lại mật khẩu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gỡ vai trò Role A" })).toBeInTheDocument();
  });

  it("own account: explains why nothing can be changed (BE OWN_ACCOUNT_NOT_MANAGEABLE)", async () => {
    setup({}, PERMISSION_SETS.editor, {}, ID);
    expect(await screen.findByText(/hệ thống không cho tự thay đổi/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Khoá tài khoản" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });

  it("shows only the actions the status machine allows", async () => {
    setup({ status: "DISABLED" });
    expect(await screen.findByRole("button", { name: "Kích hoạt lại" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Khoá tài khoản" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vô hiệu hoá" })).not.toBeInTheDocument();
  });

  it("offers unlock for a locked account", async () => {
    setup({ status: "LOCKED" });
    expect(await screen.findByRole("button", { name: "Mở khoá" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Khoá tài khoản" })).not.toBeInTheDocument();
  });
});

describe("UserDetailPage — load states", () => {
  it("maps USER_NOT_FOUND", async () => {
    stubIdentityApi(PERMISSION_SETS.editor, {
      [`GET ${url}`]: () => {
        throw new ApiError(404, "USER_NOT_FOUND", "User not found");
      },
    });
    renderIdentityScreen(<UserDetailPage id={ID} />);
    expect(await screen.findByText("Không tìm thấy người dùng")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về danh sách" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
  });
});

describe("UserDetailPage — profile", () => {
  it("PATCHes the changed profile together with the version that was loaded", async () => {
    const { api, user } = setup({}, PERMISSION_SETS.editor, {
      [`PATCH ${url}`]: () => userFixture({ fullName: "Lan Mới", version: 5 }),
    });
    const name = await screen.findByLabelText("Họ tên");
    expect(screen.getByRole("button", { name: "Lưu hồ sơ" })).toBeDisabled();
    await user.clear(name);
    await user.type(name, "Lan Mới");
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(api.of("patch", url)).toHaveLength(1));
    expect(api.of("patch", url)[0]?.body).toEqual({
      email: "lan.nguyen@stockflow.vn",
      fullName: "Lan Mới",
      version: 4,
    });
  });

  it("shows OPTIMISTIC_LOCK in Vietnamese and reloads the account", async () => {
    let gets = 0;
    const { api, user } = setup({}, PERMISSION_SETS.editor, {
      [`GET ${url}`]: () => {
        gets += 1;
        return userFixture({ version: 3 + gets });
      },
      [`PATCH ${url}`]: () => {
        throw new ApiError(409, "OPTIMISTIC_LOCK", "The record changed meanwhile, please retry");
      },
    });
    const name = await screen.findByLabelText("Họ tên");
    await user.type(name, "x");
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(await screen.findByText(/vừa được người khác thay đổi/)).toBeInTheDocument();
    await waitFor(() => expect(api.of("get", url).length).toBeGreaterThan(1));
  });

  it("puts a duplicate email on the email field", async () => {
    const { user } = setup({}, PERMISSION_SETS.editor, {
      [`PATCH ${url}`]: () => {
        throw new ApiError(
          409,
          "USER_EMAIL_ALREADY_EXISTS",
          "An account with this email already exists",
        );
      },
    });
    const email = await screen.findByLabelText("Email");
    await user.type(email, "x");
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(
      await screen.findByText("Email này đã được dùng cho một tài khoản khác."),
    ).toBeInTheDocument();
    expect(email).toBeInvalid();
  });

  it("explains a running wrong-password lock and a forced password change", async () => {
    setup({ mustChangePassword: true, lockedUntil: "2999-01-01T00:00:00Z" });
    expect(await screen.findByText(/Đang dùng mật khẩu tạm/)).toBeInTheDocument();
    expect(screen.getByText(/khoá tạm thời do nhập sai mật khẩu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở khoá" })).toBeInTheDocument();
  });
});

describe("UserDetailPage — account actions with confirm dialogs", () => {
  it("locks only after the confirm dialog, then toasts", async () => {
    const { api, user } = setup({}, PERMISSION_SETS.editor, {
      [`POST ${url}/lock`]: () => userFixture({ status: "LOCKED" }),
    });
    await user.click(await screen.findByRole("button", { name: "Khoá tài khoản" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/đăng xuất khỏi mọi thiết bị/)).toBeInTheDocument();
    expect(api.of("post", `${url}/lock`)).toHaveLength(0);
    await user.click(dialog.getByRole("button", { name: "Khoá tài khoản" }));
    await waitFor(() => expect(api.of("post", `${url}/lock`)).toHaveLength(1));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Đã khoá tài khoản và đăng xuất mọi phiên"),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cancelling the confirm dialog sends nothing", async () => {
    const { api, user } = setup();
    await user.click(await screen.findByRole("button", { name: "Vô hiệu hoá" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Quay lại" }),
    );
    expect(api.of("post", `${url}/disable`)).toHaveLength(0);
  });

  it.each([
    ["LAST_SYSTEM_ADMIN", 409, /ít nhất một quản trị viên hệ thống đang hoạt động/],
    [
      "PRIVILEGE_ESCALATION",
      403,
      /không thể cấp hoặc quản lý quyền mà chính tài khoản của bạn không có/,
    ],
    ["INVALID_USER_STATUS_TRANSITION", 409, /không thể chuyển sang trạng thái này/],
  ])("shows %s inside the dialog and keeps it open", async (code, status, message) => {
    const { user } = setup({}, PERMISSION_SETS.editor, {
      [`POST ${url}/disable`]: () => {
        throw new ApiError(status, code, "English");
      },
    });
    await user.click(await screen.findByRole("button", { name: "Vô hiệu hoá" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Vô hiệu hoá" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("enables a disabled account after confirmation", async () => {
    const { api, user } = setup({ status: "DISABLED" }, PERMISSION_SETS.editor, {
      [`POST ${url}/enable`]: () => userFixture(),
    });
    await user.click(await screen.findByRole("button", { name: "Kích hoạt lại" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Kích hoạt lại" }),
    );
    await waitFor(() => expect(api.of("post", `${url}/enable`)).toHaveLength(1));
  });
});

describe("UserDetailPage — password reset", () => {
  it("generates a temporary password and shows it once, with the sessions ended", async () => {
    const { api, user } = setup({}, PERMISSION_SETS.editor, {
      [`POST ${url}/password-reset`]: () => ({
        temporaryPassword: "Reset3dPass9",
        sessionsEnded: 2,
      }),
    });
    await user.click(await screen.findByRole("button", { name: "Đặt lại mật khẩu" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Đặt lại mật khẩu" }),
    );
    await waitFor(() => expect(api.of("post", `${url}/password-reset`)[0]?.body).toEqual({}));
    expect(await screen.findByText("Reset3dPass9")).toBeInTheDocument();
    expect(screen.getByText(/đăng xuất 2 phiên đang mở/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đã lưu lại, đóng" }));
    await waitFor(() => expect(screen.queryByText("Reset3dPass9")).not.toBeInTheDocument());
  });

  it("keeps neither the reset password nor the generated one in the MutationCache", async () => {
    const { user, client } = setup({}, PERMISSION_SETS.editor, {
      [`POST ${url}/password-reset`]: () => ({
        temporaryPassword: "Reset3dPass9",
        sessionsEnded: 1,
      }),
    });
    await user.click(await screen.findByRole("button", { name: "Đặt lại mật khẩu" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Mật khẩu mới"), "Typed1Passw0rd");
    await user.click(dialog.getByRole("button", { name: "Đặt lại mật khẩu" }));
    expect(await screen.findByText("Reset3dPass9")).toBeInTheDocument();
    const dump = JSON.stringify(
      client
        .getMutationCache()
        .getAll()
        .map((m) => [m.state.variables, m.state.data]),
    );
    expect(dump).not.toContain("Reset3dPass9");
    expect(dump).not.toContain("Typed1Passw0rd");
  });

  it("does not claim the password change is enforced", async () => {
    const { user } = setup({}, PERMISSION_SETS.editor, {
      [`POST ${url}/password-reset`]: () => ({
        temporaryPassword: "Reset3dPass9",
        sessionsEnded: 0,
      }),
    });
    await user.click(await screen.findByRole("button", { name: "Đặt lại mật khẩu" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Đặt lại mật khẩu" }),
    );
    expect(await screen.findByText(/nên đổi mật khẩu sau khi đăng nhập/)).toBeInTheDocument();
    expect(screen.queryByText(/phải đổi mật khẩu/i)).not.toBeInTheDocument();
  });

  it("validates a chosen password like the BE and sends it when valid", async () => {
    const { api, user } = setup({}, PERMISSION_SETS.editor, {
      [`POST ${url}/password-reset`]: () => ({ sessionsEnded: 0 }),
    });
    await user.click(await screen.findByRole("button", { name: "Đặt lại mật khẩu" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Mật khẩu mới"), "weak");
    expect(dialog.getByRole("button", { name: "Đặt lại mật khẩu" })).toBeDisabled();
    await user.clear(dialog.getByLabelText("Mật khẩu mới"));
    await user.type(dialog.getByLabelText("Mật khẩu mới"), "Abcdefghi1");
    await user.click(dialog.getByRole("button", { name: "Đặt lại mật khẩu" }));
    await waitFor(() =>
      expect(api.of("post", `${url}/password-reset`)[0]?.body).toEqual({
        newPassword: "Abcdefghi1",
      }),
    );
    expect(screen.queryByText(/hệ thống sẽ không hiển thị lại/)).not.toBeInTheDocument();
  });
});

describe("UserDetailPage — roles and warehouses", () => {
  it("assigns a role from the catalog", async () => {
    const { api, user } = setup({}, PERMISSION_SETS.editor, {
      [`POST ${url}/roles`]: () => null,
    });
    await user.click(await screen.findByRole("combobox", { name: "Chọn vai trò để gán" }));
    await user.click(await screen.findByRole("option", { name: "Tổ trưởng ca" }));
    await user.click(screen.getByRole("button", { name: "Gán vai trò" }));
    await waitFor(() =>
      expect(api.of("post", `${url}/roles`)[0]?.body).toEqual({ roleCode: "SHIFT_LEAD" }),
    );
  });

  it("does not list the customer role among the roles that can be assigned", async () => {
    const { user } = setup({}, PERMISSION_SETS.editor, {
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
    await user.click(await screen.findByRole("combobox", { name: "Chọn vai trò để gán" }));
    expect(await screen.findByRole("option", { name: "Tổ trưởng ca" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Customer" })).not.toBeInTheDocument();
  });

  it("removes a role only after confirmation and shows BE refusals", async () => {
    const { api, user } = setup({}, PERMISSION_SETS.editor, {
      [`DELETE ${url}/roles/ROLE_A`]: () => {
        throw new ApiError(
          409,
          "LAST_SYSTEM_ADMIN",
          "At least one active System Admin must remain",
        );
      },
    });
    await user.click(await screen.findByRole("button", { name: "Gỡ vai trò Role A" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(api.of("delete", `${url}/roles/ROLE_A`)).toHaveLength(0);
    await user.click(dialog.getByRole("button", { name: "Gỡ vai trò" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent(/ít nhất một quản trị viên/);
  });

  it("without roles READ it lists role codes, can remove but cannot assign", async () => {
    setup({}, PERMISSION_SETS.noRolesRead);
    expect(await screen.findByText("ROLE_A")).toBeInTheDocument();
    expect(screen.getByText(/chỉ gỡ được vai trò, chưa gán thêm được/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Chọn vai trò để gán" })).not.toBeInTheDocument();
  });

  it("PUTs the complete warehouse set, not a delta", async () => {
    const { api, user } = setup({}, PERMISSION_SETS.editor, {
      [`PUT ${url}/warehouses`]: () => userFixture({ warehouseIds: ["WH-HN", "WH-HCM"] }),
    });
    const hcm = await screen.findByRole("checkbox", { name: "Kho TP.HCM" });
    expect(screen.getByRole("button", { name: "Lưu kho" })).toBeDisabled();
    await user.click(hcm);
    await user.click(screen.getByRole("button", { name: "Lưu kho" }));
    await waitFor(() => expect(api.of("put", `${url}/warehouses`)).toHaveLength(1));
    expect(api.of("put", `${url}/warehouses`)[0]?.body).toEqual({
      warehouseIds: ["WH-HN", "WH-HCM"],
    });
  });

  it("can clear every warehouse (empty set) and keeps an inactive assigned warehouse visible", async () => {
    const { api, user } = setup({ warehouseIds: ["WH-HN", "WH-OLD"] }, PERMISSION_SETS.editor, {
      [`PUT ${url}/warehouses`]: () => userFixture({ warehouseIds: [] }),
    });
    expect(await screen.findByRole("checkbox", { name: "Kho cũ" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Kho cũ" }));
    await user.click(screen.getByRole("checkbox", { name: "Kho Hà Nội" }));
    await user.click(screen.getByRole("button", { name: "Lưu kho" }));
    await waitFor(() =>
      expect(api.of("put", `${url}/warehouses`)[0]?.body).toEqual({ warehouseIds: [] }),
    );
  });

  it("warns when a warehouse-scoped role has no warehouse", async () => {
    setup({ roles: ["ROLE_B"], warehouseIds: [] });
    expect(
      await screen.findByText(/chưa có kho nào — họ không truy cập được dữ liệu kho/),
    ).toBeInTheDocument();
  });

  it("without warehouse READ it shows the count and offers no editor", async () => {
    setup(
      { warehouseIds: ["WH-HN", "WH-HCM"] },
      PERMISSION_SETS.noRolesRead.filter((c) => c !== "warehouse-warehouses:READ"),
    );
    expect(await screen.findByText(/2 kho đang được gán/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu kho" })).not.toBeInTheDocument();
  });

  it("shows a warehouse refusal from the BE", async () => {
    const { user } = setup({}, PERMISSION_SETS.editor, {
      [`PUT ${url}/warehouses`]: () => {
        throw new ApiError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found");
      },
    });
    await user.click(await screen.findByRole("checkbox", { name: "Kho TP.HCM" }));
    await user.click(screen.getByRole("button", { name: "Lưu kho" }));
    expect(await screen.findByText(/không còn tồn tại/)).toBeInTheDocument();
  });
});
