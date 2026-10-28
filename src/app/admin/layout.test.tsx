import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CREDIT_HOLD_PERMISSIONS,
  CUSTOMER_CREDIT_PROFILE_PERMISSIONS,
  ORDER_PERMISSIONS,
} from "@/constants";
import { PERMISSION_QUERY } from "@/constants/permissions";
import { OrderPermissionGate } from "@/features/order/components/OrderPermissionGate";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import AdminLayout from "./layout";

import type { ReactNode } from "react";

const { replace, logoutApi } = vi.hoisted(() => ({ replace: vi.fn(), logoutApi: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/lib/auth/auth-api", () => ({ logoutApi }));
vi.mock("@/components/backoffice/BackofficeShell", () => ({
  BackofficeShell: ({ children }: { children: ReactNode }) => <div>Admin shell{children}</div>,
}));
vi.mock("@/lib/auth/components/RoleSwitcher", () => ({
  RoleSwitcher: () => <div>Role toolbar</div>,
}));

const DENIED = "Tài khoản không dùng được trang quản trị";

/** BE `/identity/me/permissions` của phiên — `roles` là mã vai trò BE. */
function grant(roles: string[], permissions: string[]) {
  return vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url !== PERMISSION_QUERY.path) throw new Error(`Không có mock cho GET ${url}`);
    return { data: { roles, permissions, dataScope: "ALL" } };
  });
}

function signIn() {
  useAuthStore.getState().login(
    {
      userId: "layout-user",
      username: "user",
      fullName: null,
      email: "user@example.com",
      status: "ACTIVE",
      roles: [],
      lastLoginAt: null,
      mustChangePassword: false,
    },
    false,
  );
}

/** Mọi route `/admin/**` đều nằm dưới `app/admin/layout.tsx` — render layout + trang con. */
function renderAdmin(page: ReactNode = <div>Admin child</div>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminLayout>{page}</AdminLayout>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.getState().logout(false);
  localStorage.clear();
  replace.mockReset();
  logoutApi.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  useAuthStore.getState().logout(false);
  vi.restoreAllMocks();
});

describe("admin layout — phiên đăng nhập (AuthGuard)", () => {
  it("I. chưa đăng nhập → về /login, không hiện shell / trang", () => {
    renderAdmin();
    expect(screen.queryByText("Admin shell")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin child")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});

describe("admin layout — cổng back-office chung (BE ScopeGuards#requireBackOffice)", () => {
  it("A/B. CUSTOMER có sales-orders:VIEW_PAGE + READ vào thẳng trang con /admin/... → bị chặn", async () => {
    signIn();
    grant(["CUSTOMER"], [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read]);
    renderAdmin(
      <OrderPermissionGate permissions={[ORDER_PERMISSIONS.viewPage]} variant="list">
        <div>Danh sách đơn</div>
      </OrderPermissionGate>,
    );

    expect(await screen.findByText(DENIED)).toBeInTheDocument();
    // Quyền tính năng đủ cho cổng trang — nhưng cổng chung chặn trước: không shell, không trang
    expect(screen.queryByText("Admin shell")).not.toBeInTheDocument();
    expect(screen.queryByText("Danh sách đơn")).not.toBeInTheDocument();
    // Không redirect (tránh vòng lặp /admin ↔ /login khi phiên còn hiệu lực)
    expect(replace).not.toHaveBeenCalled();
  });

  it("CUSTOMER + vai trò tự tạo (tài khoản BE hợp lệ không có — ROLE_NOT_ASSIGNABLE) → chặn để phòng thủ", async () => {
    signIn();
    grant(
      ["CUSTOMER", "CUSTOM_SUPPORT_CUSTOM"],
      [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read],
    );
    renderAdmin();
    expect(await screen.findByText(DENIED)).toBeInTheDocument();
    expect(screen.queryByText("Admin shell")).not.toBeInTheDocument();
  });

  it("không vai trò nào (kể cả có đủ quyền, vd BE tắt security) → chặn (fail closed)", async () => {
    signIn();
    grant(
      [],
      [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read, CREDIT_HOLD_PERMISSIONS.viewPage],
    );
    renderAdmin();
    expect(await screen.findByText(DENIED)).toBeInTheDocument();
    expect(screen.queryByText("Admin shell")).not.toBeInTheDocument();
  });

  it("tải quyền bị 403 → coi như không phải back-office: báo từ chối + Đăng xuất, không hiện shell", async () => {
    signIn();
    vi.spyOn(api, "get").mockRejectedValue(new ApiError(403, "FORBIDDEN", "denied"));
    renderAdmin();
    expect(await screen.findByText(DENIED)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeInTheDocument();
    expect(screen.queryByText("Admin shell")).not.toBeInTheDocument();
  });

  it("bị chặn → nút Đăng xuất gọi logout rồi về /login", async () => {
    signIn();
    grant(["CUSTOMER"], [ORDER_PERMISSIONS.viewPage]);
    renderAdmin();
    await userEvent.click(await screen.findByRole("button", { name: "Đăng xuất" }));
    expect(logoutApi).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("H. đang tải vai trò → khung chờ, không redirect, không báo từ chối, không nháy shell", () => {
    signIn();
    vi.spyOn(api, "get").mockReturnValue(new Promise(() => {}));
    renderAdmin();
    expect(screen.queryByText("Admin shell")).not.toBeInTheDocument();
    expect(screen.queryByText(DENIED)).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("lỗi tải quyền (503) → báo lỗi + Thử lại, không coi là khách hàng", async () => {
    signIn();
    vi.spyOn(api, "get").mockRejectedValue(new ApiError(503, "SERVICE_UNAVAILABLE", "down"));
    renderAdmin();
    expect(await screen.findByText("Không thể tải quyền truy cập")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.queryByText(DENIED)).not.toBeInTheDocument();
    expect(screen.queryByText("Admin shell")).not.toBeInTheDocument();
  });

  it("C/G. SYSTEM_ADMIN → qua cổng chung, có shell + trang", async () => {
    signIn();
    grant(["SYSTEM_ADMIN"], []);
    renderAdmin();
    expect(await screen.findByText("Admin child")).toBeInTheDocument();
    expect(screen.getByText("Admin shell")).toBeInTheDocument();
    expect(screen.getByText("Role toolbar")).toBeInTheDocument();
  });

  it("C. ORDER_COORDINATOR qua cổng nhờ vai trò, không nhờ customer-credit-profiles:READ", async () => {
    signIn();
    grant(["ORDER_COORDINATOR"], [CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read]);
    renderAdmin();
    expect(await screen.findByText("Admin child")).toBeInTheDocument();
  });

  it("vai trò back-office mà KHÔNG có quyền nào vẫn qua cổng chung (quyền trang quyết định sau)", async () => {
    signIn();
    grant(["INVENTORY_PLANNER"], []);
    renderAdmin();
    expect(await screen.findByText("Admin child")).toBeInTheDocument();
  });
});

describe("admin layout — sau cổng chung, cổng quyền từng trang vẫn quyết định", () => {
  const ACCOUNTANT = [
    CREDIT_HOLD_PERMISSIONS.viewPage,
    CREDIT_HOLD_PERMISSIONS.read,
    CREDIT_HOLD_PERMISSIONS.approve,
    CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read,
  ];

  it("D/E. ACCOUNTANT (không có sales-orders:VIEW_PAGE) vào được hàng đợi công nợ", async () => {
    signIn();
    grant(["ACCOUNTANT"], ACCOUNTANT);
    renderAdmin(
      <OrderPermissionGate permissions={[CREDIT_HOLD_PERMISSIONS.viewPage]} variant="list">
        <div>Hàng đợi công nợ</div>
      </OrderPermissionGate>,
    );
    expect(await screen.findByText("Hàng đợi công nợ")).toBeInTheDocument();
    expect(screen.getByText("Admin shell")).toBeInTheDocument();
  });

  it("F. ACCOUNTANT qua cổng chung nhưng trang Đơn hàng (sales-orders:VIEW_PAGE) vẫn từ chối", async () => {
    signIn();
    grant(["ACCOUNTANT"], ACCOUNTANT);
    renderAdmin(
      <OrderPermissionGate permissions={[ORDER_PERMISSIONS.viewPage]} variant="list">
        <div>Danh sách đơn</div>
      </OrderPermissionGate>,
    );
    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(screen.getByText("Admin shell")).toBeInTheDocument();
    expect(screen.queryByText("Danh sách đơn")).not.toBeInTheDocument();
    expect(screen.queryByText(DENIED)).not.toBeInTheDocument();
  });

  it("nhân viên chỉ có vai trò tự tạo + sales-orders:VIEW_PAGE → qua cổng chung, vào được trang Đơn hàng", async () => {
    signIn();
    grant(["CUSTOM_SUPPORT_CUSTOM"], [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read]);
    renderAdmin(
      <OrderPermissionGate permissions={[ORDER_PERMISSIONS.viewPage]} variant="list">
        <div>Danh sách đơn</div>
      </OrderPermissionGate>,
    );
    expect(await screen.findByText("Danh sách đơn")).toBeInTheDocument();
    expect(screen.getByText("Admin shell")).toBeInTheDocument();
  });

  it("vai trò tự tạo KHÔNG có quyền trang → cổng chung cho qua, cổng trang (OrderPermissionGate) từ chối", async () => {
    signIn();
    grant(["CUSTOM_SUPPORT_CUSTOM"], [CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read]);
    renderAdmin(
      <OrderPermissionGate permissions={[ORDER_PERMISSIONS.viewPage]} variant="list">
        <div>Danh sách đơn</div>
      </OrderPermissionGate>,
    );
    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(screen.getByText("Admin shell")).toBeInTheDocument();
    expect(screen.queryByText("Danh sách đơn")).not.toBeInTheDocument();
    expect(screen.queryByText(DENIED)).not.toBeInTheDocument();
  });

  it("E. CUSTOMER có đủ quyền hàng đợi công nợ vẫn bị cổng chung chặn trước", async () => {
    signIn();
    grant(["CUSTOMER"], ACCOUNTANT);
    renderAdmin(
      <OrderPermissionGate permissions={[CREDIT_HOLD_PERMISSIONS.viewPage]} variant="list">
        <div>Hàng đợi công nợ</div>
      </OrderPermissionGate>,
    );
    expect(await screen.findByText(DENIED)).toBeInTheDocument();
    expect(screen.queryByText("Hàng đợi công nợ")).not.toBeInTheDocument();
  });
});
