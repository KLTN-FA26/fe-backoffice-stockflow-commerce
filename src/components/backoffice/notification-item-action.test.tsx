/**
 * Audit r2 einvoice M-1: thông báo "hoá đơn đã phát hành nhưng chưa gửi được thư" của Sale có nút gửi lại hoá đơn ngay trên
 * thông báo (Sale không có quyền xem hoá đơn). Quyền `customer-legal-profiles:UPDATE`; thông báo khác → không có nút.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EINVOICE_RESEND_EMAIL_PERMISSION } from "@/constants/einvoice";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { notificationItemAction } from "./notification-item-action";

import type { Notification } from "@/features/notification";

afterEach(() => vi.restoreAllMocks());

const EINVOICE_ID = "0e380000-0000-4000-8000-000000000301";
const notice = (over: Partial<Notification> = {}): Notification => ({
  id: "77777777-7777-4777-8777-777777777777",
  category: "EINVOICE_BUYER_EMAIL_MISSING",
  severity: "WARN",
  title: "Hoá đơn của đơn SO-1 đã phát hành nhưng chưa gửi được thư",
  link: "/admin/customers/c-1",
  sourceType: "EINVOICE",
  sourceId: EINVOICE_ID,
  createdAt: "2026-11-24T01:00:00Z",
  read: false,
  ...over,
});

function mount(item: Notification, permissions: string[]) {
  useAuthStore.setState({
    user: {
      userId: "u-sale",
      fullName: "Sale",
      email: "s@example.test",
      roles: [],
      username: "sale",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
    impersonatedRole: null,
  });
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/identity/me/permissions")
      return { data: { roles: [], permissions, dataScope: "ALL" } };
    throw new Error(`Không có mock cho GET ${url}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>{notificationItemAction(item)}</QueryClientProvider>,
  );
}

describe("notificationItemAction (audit r2 einvoice M-1)", () => {
  it("Sales resend the invoice straight from the notice, and see where it went", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        einvoiceId: EINVOICE_ID,
        recipient: "hoadon@khach.vn",
        requestedAt: "2026-11-24T02:00:00Z",
      },
    });
    mount(notice(), [EINVOICE_RESEND_EMAIL_PERMISSION]);
    await userEvent.click(
      await screen.findByRole("button", { name: /Gửi lại hoá đơn qua e-mail/ }),
    );
    await waitFor(() => expect(post).toHaveBeenCalledWith(`/einvoices/${EINVOICE_ID}/email`));
    expect(await screen.findByText(/Đã yêu cầu gửi tới hoadon@khach.vn/)).toBeInTheDocument();
  });

  it("says to record the e-mail first when the customer still has none", async () => {
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(
        409,
        "EINVOICE_BUYER_PROFILE_INCOMPLETE",
        "no e-mail",
        undefined,
        undefined,
        undefined,
        undefined,
        {
          missing: ["EMAIL"],
        },
      ),
    );
    mount(notice(), [EINVOICE_RESEND_EMAIL_PERMISSION]);
    await userEvent.click(
      await screen.findByRole("button", { name: /Gửi lại hoá đơn qua e-mail/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/Khách chưa có e-mail nhận hoá đơn/);
  });

  it("nothing without the permission, and nothing on other notices", async () => {
    const { unmount } = mount(notice(), []);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    expect(notificationItemAction(notice({ category: "EINVOICE_DUE" }))).toBeNull();
    expect(notificationItemAction(notice({ sourceId: null }))).toBeNull();
  });
});
