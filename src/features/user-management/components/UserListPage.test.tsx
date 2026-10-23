import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { PERMISSION_SETS, renderIdentityScreen, stubIdentityApi } from "../__fixtures__/render";
import { userFixture, userPage } from "../__fixtures__/users";

import { UserListPage } from "./UserListPage";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(() => vi.restoreAllMocks());

const rows = [
  userFixture(),
  userFixture({
    userId: "22222222-2222-4222-8222-222222222222",
    username: "binh.tran",
    fullName: "Trần Bình",
    email: "binh@stockflow.vn",
    status: "LOCKED",
    roles: ["ROLE_B", "SHIFT_LEAD"],
    warehouseIds: ["WH-HN", "WH-HCM", "WH-OLD"],
    lastLoginAt: null,
  }),
];

describe("UserListPage — gating by permission codes", () => {
  it("without identity-users:READ it never calls the list and says so", async () => {
    const api = stubIdentityApi(PERMISSION_SETS.none, {
      "GET /identity/users": () => userPage(rows),
    });
    renderIdentityScreen(<UserListPage />);
    expect(
      await screen.findByText("Bạn không có quyền xem danh sách người dùng."),
    ).toBeInTheDocument();
    expect(api.of("get", "/identity/users")).toHaveLength(0);
  });

  it("READ only → table, no create button", async () => {
    stubIdentityApi(PERMISSION_SETS.readOnly, { "GET /identity/users": () => userPage(rows) });
    renderIdentityScreen(<UserListPage />);
    expect(await screen.findByText("lan.nguyen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm người dùng/ })).not.toBeInTheDocument();
  });

  it("READ + CREATE → create button", async () => {
    stubIdentityApi(PERMISSION_SETS.full, { "GET /identity/users": () => userPage(rows) });
    renderIdentityScreen(<UserListPage />);
    expect(await screen.findByRole("button", { name: /Thêm người dùng/ })).toBeInTheDocument();
  });
});

describe("UserListPage — table", () => {
  it("shows username, name, email, role names, warehouse names, status and last login", async () => {
    stubIdentityApi(PERMISSION_SETS.readOnly, { "GET /identity/users": () => userPage(rows) });
    renderIdentityScreen(<UserListPage />);
    const row = (await screen.findByText("binh.tran")).closest("tr");
    if (!row) throw new Error("row");
    const cells = within(row);
    expect(cells.getByText("Trần Bình")).toBeInTheDocument();
    expect(cells.getByText("binh@stockflow.vn")).toBeInTheDocument();
    expect(cells.getByText("Role B, Tổ trưởng ca")).toBeInTheDocument();
    expect(cells.getByText(/Kho Hà Nội, Kho TP.HCM \+1/)).toBeInTheDocument();
    expect(cells.getByText("Đã khoá")).toBeInTheDocument();
    expect(cells.getByText("Chưa đăng nhập")).toBeInTheDocument();
    expect(screen.getAllByText("Đang hoạt động").length).toBeGreaterThan(0);
  });

  it("shows a warehouse count when the caller cannot read the warehouse directory", async () => {
    stubIdentityApi([...PERMISSION_SETS.readOnly.slice(0, 2)], {
      "GET /identity/users": () => userPage(rows),
    });
    renderIdentityScreen(<UserListPage />);
    const row = (await screen.findByText("binh.tran")).closest("tr");
    expect(within(row as HTMLElement).getByText("3 kho")).toBeInTheDocument();
  });

  it("opens the detail page when a row is clicked", async () => {
    stubIdentityApi(PERMISSION_SETS.readOnly, { "GET /identity/users": () => userPage(rows) });
    renderIdentityScreen(<UserListPage />);
    await userEvent.setup().click(await screen.findByText("Trần Bình"));
    expect(router.push).toHaveBeenCalledWith("/admin/users/22222222-2222-4222-8222-222222222222");
  });
});

describe("UserListPage — filters and paging go to the server", () => {
  it("sends status, role and search; resets to the first page", async () => {
    const api = stubIdentityApi(PERMISSION_SETS.readOnly, {
      "GET /identity/users": () => userPage(rows),
    });
    renderIdentityScreen(<UserListPage />, "?page=3");
    const user = userEvent.setup();
    await screen.findByText("lan.nguyen");
    expect(api.of("get", "/identity/users")[0]?.params?.get("page")).toBe("2");

    await user.click(screen.getByRole("button", { name: "Đã khoá" }));
    await waitFor(() => {
      const last = api.of("get", "/identity/users").at(-1)?.params;
      expect(last?.get("status")).toBe("LOCKED");
      expect(last?.get("page")).toBe("0");
    });

    await user.type(screen.getByRole("searchbox"), "binh");
    await waitFor(() =>
      expect(api.of("get", "/identity/users").at(-1)?.params?.get("q")).toBe("binh"),
    );

    await user.click(screen.getByRole("button", { name: "Bỏ bộ lọc" }));
    await waitFor(() =>
      expect(api.of("get", "/identity/users").at(-1)?.params?.get("status")).toBeNull(),
    );
  });

  it("filters by role through the role select", async () => {
    const api = stubIdentityApi(PERMISSION_SETS.readOnly, {
      "GET /identity/users": () => userPage(rows),
    });
    renderIdentityScreen(<UserListPage />);
    const user = userEvent.setup();
    await screen.findByText("lan.nguyen");
    await user.click(screen.getByRole("combobox", { name: "Lọc theo vai trò" }));
    await user.click(await screen.findByRole("option", { name: "Tổ trưởng ca" }));
    await waitFor(() =>
      expect(api.of("get", "/identity/users").at(-1)?.params?.get("role")).toBe("SHIFT_LEAD"),
    );
  });

  it("hides the role filter when the caller cannot read roles", async () => {
    stubIdentityApi([...PERMISSION_SETS.readOnly.slice(0, 1)], {
      "GET /identity/users": () => userPage(rows),
    });
    renderIdentityScreen(<UserListPage />);
    await screen.findByText("lan.nguyen");
    expect(screen.queryByRole("combobox", { name: "Lọc theo vai trò" })).not.toBeInTheDocument();
  });

  it("sorts on the server by clicking a sortable header", async () => {
    const api = stubIdentityApi(PERMISSION_SETS.readOnly, {
      "GET /identity/users": () => userPage(rows),
    });
    renderIdentityScreen(<UserListPage />);
    await screen.findByText("lan.nguyen");
    await userEvent.setup().click(screen.getByRole("button", { name: /Họ tên/ }));
    await waitFor(() =>
      expect(api.of("get", "/identity/users").at(-1)?.params?.get("sort")).toBe("fullName,asc"),
    );
  });
});

describe("UserListPage — every state has UI", () => {
  it("distinguishes 'no users yet' from 'filter matched nothing'", async () => {
    stubIdentityApi(PERMISSION_SETS.full, { "GET /identity/users": () => userPage([]) });
    renderIdentityScreen(<UserListPage />);
    expect(await screen.findByText("Chưa có người dùng")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Thêm người dùng/ }).length).toBeGreaterThan(1);
  });

  it("shows 'no results' with a clear-filter action when filtered", async () => {
    stubIdentityApi(PERMISSION_SETS.readOnly, { "GET /identity/users": () => userPage([]) });
    renderIdentityScreen(<UserListPage />, "?q=zzz");
    expect(await screen.findByText("Không tìm thấy kết quả")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có người dùng")).not.toBeInTheDocument();
  });

  it("shows the mapped error with retry instead of an empty list", async () => {
    let fail = true;
    const api = stubIdentityApi(PERMISSION_SETS.readOnly, {
      "GET /identity/users": () => {
        if (fail) throw new ApiError(400, "UNSUPPORTED_PARAMETER", "Unsupported parameter value");
        return userPage(rows);
      },
    });
    renderIdentityScreen(<UserListPage />);
    expect(await screen.findByText("Không tải được danh sách người dùng.")).toBeInTheDocument();
    expect(screen.getByText("Bộ lọc hoặc cách sắp xếp không được hỗ trợ.")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("lan.nguyen")).toBeInTheDocument();
    expect(api.of("get", "/identity/users").length).toBeGreaterThan(1);
  });
});
