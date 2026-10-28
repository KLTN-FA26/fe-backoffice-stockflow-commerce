import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NOTIFICATION_API, NOTIFICATION_LABELS } from "@/constants/notifications";

import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { NotificationBell } from "./NotificationBell";

import type { AuthUser } from "@/lib/auth/auth-store";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const staff: AuthUser = {
  userId: "staff-1",
  username: "staff",
  email: "staff@example.test",
  fullName: null,
  status: "ACTIVE",
  roles: ["INVENTORY_MANAGER"],
  lastLoginAt: null,
  mustChangePassword: false,
};
const notice = {
  id: "77777777-7777-4777-8777-777777777777",
  category: "INVENTORY_ALERT",
  severity: "WARN",
  title: "Hàng sắp hết",
  link: "/admin/inventory/alerts?sku=CUP",
  sourceType: "STOCK_ALERT",
  sourceId: "stock-1",
  createdAt: "2026-10-15T01:00:00Z",
  read: false,
};
const page = {
  items: [notice],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
  unreadCount: 1,
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.getState().login(staff, false);
  push.mockReset();
});

afterEach(() => {
  cleanup();
  useAuthStore.getState().logout(false);
  vi.restoreAllMocks();
});

describe("notification bell", () => {
  it("shows list count without initial count GET; marks and navigates on selection", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: page });
    const post = vi.spyOn(api, "post").mockResolvedValue({ status: 204 });
    expect(await screen.queryByText(NOTIFICATION_LABELS.title)).toBeNull();
    mount();
    const user = userEvent.setup();
    const bell = await screen.findByRole("button", { name: NOTIFICATION_LABELS.unreadBadge(1) });
    expect(get.mock.calls.every(([url]) => url === NOTIFICATION_API.inbox)).toBe(true);
    await user.click(bell);
    expect(await screen.findByText("Hàng sắp hết")).toBeInTheDocument();
    expect(screen.getByText(NOTIFICATION_LABELS.severity.WARN)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Hàng sắp hết/ }));
    expect(post).toHaveBeenCalledWith(NOTIFICATION_API.markRead(notice.id));
    expect(push).toHaveBeenCalledWith(notice.link);
  });

  it("mark-all-read uses the own-inbox endpoint", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: page });
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { updated: 1 } });
    mount();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: NOTIFICATION_LABELS.unreadBadge(1) }),
    );
    await user.click(screen.getByRole("button", { name: NOTIFICATION_LABELS.markAllRead }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(NOTIFICATION_API.markAllRead));
  });

  it("switching authenticated identities never displays cached inbox rows from the previous user", async () => {
    vi.spyOn(api, "get").mockImplementation(async () => {
      const userId = useAuthStore.getState().user?.userId;
      return {
        data:
          userId === staff.userId ? page : { ...page, items: [], totalElements: 0, unreadCount: 0 },
      };
    });
    mount();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: NOTIFICATION_LABELS.unreadBadge(1) }),
    );
    expect(await screen.findByText("Hàng sắp hết")).toBeInTheDocument();
    useAuthStore.getState().login({ ...staff, userId: "staff-2" }, false);
    await waitFor(() => expect(screen.queryByText("Hàng sắp hết")).not.toBeInTheDocument());
    expect(await screen.findByText(NOTIFICATION_LABELS.empty)).toBeInTheDocument();
  });
});
