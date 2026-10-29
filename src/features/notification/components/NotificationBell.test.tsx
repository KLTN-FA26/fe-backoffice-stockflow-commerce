import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NOTIFICATION_API, NOTIFICATION_LABELS } from "@/constants/notifications";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { NotificationBell } from "./NotificationBell";

import type { AuthUser } from "@/lib/auth/auth-store";

// Mocked transport (api.get / api.post spies): proves FE behaviour against the BE contract shape,
// not integration with a running backend.
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
// BE InventoryAlertMessages: `/admin/inventory/alerts?kind=<kind>[&warehouseId=<uuid>]`.
const ALERT_LINK =
  "/admin/inventory/alerts?kind=EXPIRED&warehouseId=0e380000-0000-4000-8000-0000000000a1";
const notice = {
  id: "77777777-7777-4777-8777-777777777777",
  category: "INVENTORY_ALERT",
  severity: "CRITICAL",
  title: "Hàng sắp hết",
  link: ALERT_LINK,
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
const emptyPage = { ...page, items: [], totalElements: 0, totalPages: 0, unreadCount: 0 };

type Params = { unreadOnly?: boolean; page?: number };
const inboxCalls = (get: { mock: { calls: unknown[][] } }) =>
  get.mock.calls.filter((call) => call[0] === NOTIFICATION_API.inbox);
const paramsOf = (call: unknown[]) => (call[1] as { params: Params }).params;

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>,
  );
}

async function openBell(count = 1) {
  const user = userEvent.setup();
  const name = count ? NOTIFICATION_LABELS.unreadBadge(count) : NOTIFICATION_LABELS.trigger;
  await user.click(await screen.findByRole("button", { name }));
  return user;
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
  it("shows list count without initial count GET; marks and navigates to the inventory-alert page", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: page });
    const post = vi.spyOn(api, "post").mockResolvedValue({ status: 204 });
    mount();
    const user = await openBell();
    expect(get.mock.calls.every(([url]) => url === NOTIFICATION_API.inbox)).toBe(true);
    expect(await screen.findByText("Hàng sắp hết")).toBeInTheDocument();
    expect(screen.getByText(NOTIFICATION_LABELS.severity.CRITICAL)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Hàng sắp hết/ }));
    expect(post).toHaveBeenCalledWith(NOTIFICATION_API.markRead(notice.id));
    expect(push).toHaveBeenCalledWith(ALERT_LINK);
  });

  it("marks an item whose link is unsafe as read but never navigates", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { ...page, items: [{ ...notice, link: "/\t/evil.test" }] },
    });
    const post = vi.spyOn(api, "post").mockResolvedValue({ status: 204 });
    mount();
    const user = await openBell();
    await user.click(await screen.findByRole("button", { name: /Hàng sắp hết/ }));
    expect(post).toHaveBeenCalledWith(NOTIFICATION_API.markRead(notice.id));
    expect(push).not.toHaveBeenCalled();
  });

  it("mark-all-read uses the own-inbox endpoint and clears the badge", async () => {
    let read = false;
    vi.spyOn(api, "get").mockImplementation(async () => ({
      data: read ? { ...page, items: [{ ...notice, read: true }], unreadCount: 0 } : page,
    }));
    const post = vi.spyOn(api, "post").mockImplementation(async () => {
      read = true;
      return { data: { updated: 1 } };
    });
    mount();
    const user = await openBell();
    await user.click(screen.getByRole("button", { name: NOTIFICATION_LABELS.markAllRead }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(NOTIFICATION_API.markAllRead));
    expect(
      await screen.findByRole("button", { name: NOTIFICATION_LABELS.trigger }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: NOTIFICATION_LABELS.markAllRead })).toBeDisabled();
  });

  it("refetches the inbox after 404 NOTIFICATION_NOT_FOUND so a row that is not the caller's disappears", async () => {
    let gone = false;
    const get = vi
      .spyOn(api, "get")
      .mockImplementation(async () => ({ data: gone ? emptyPage : page }));
    vi.spyOn(api, "post").mockImplementation(async () => {
      gone = true;
      throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "No notification");
    });
    mount();
    const user = await openBell();
    const before = inboxCalls(get).length;
    await user.click(await screen.findByRole("button", { name: /Hàng sắp hết/ }));
    await waitFor(() => expect(inboxCalls(get).length).toBeGreaterThan(before));
    await waitFor(() => expect(screen.queryByText("Hàng sắp hết")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: NOTIFICATION_LABELS.trigger })).toBeInTheDocument();
  });

  it("steps back to the last existing page when mark-all-read empties the unread page", async () => {
    let cleared = false;
    const get = vi.spyOn(api, "get").mockImplementation(async (_url, config) => {
      const { unreadOnly, page: index = 0 } = (config as { params?: Params }).params ?? {};
      if (unreadOnly && cleared) return { data: emptyPage };
      return {
        data: {
          ...page,
          page: index,
          totalPages: 2,
          totalElements: 11,
          hasNext: index === 0,
          hasPrevious: index === 1,
          unreadCount: cleared ? 0 : 11,
        },
      };
    });
    vi.spyOn(api, "post").mockImplementation(async () => {
      cleared = true;
      return { data: { updated: 11 } };
    });
    mount();
    const user = await openBell(11);
    await user.click(screen.getByRole("button", { name: NOTIFICATION_LABELS.unreadOnly }));
    await user.click(await screen.findByRole("button", { name: NOTIFICATION_LABELS.next }));
    expect(await screen.findByText(NOTIFICATION_LABELS.page(2, 2))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: NOTIFICATION_LABELS.markAllRead }));
    expect(await screen.findByText(NOTIFICATION_LABELS.emptyUnread)).toBeInTheDocument();
    const last = inboxCalls(get).at(-1);
    expect(last && paramsOf(last)).toMatchObject({ unreadOnly: true, page: 0 });
  });

  it("switching identities with the dropdown open never displays the previous user's rows", async () => {
    vi.spyOn(api, "get").mockImplementation(async () => {
      const userId = useAuthStore.getState().user?.userId;
      return { data: userId === staff.userId ? page : emptyPage };
    });
    mount();
    await openBell();
    expect(await screen.findByText("Hàng sắp hết")).toBeInTheDocument();
    act(() => useAuthStore.getState().login({ ...staff, userId: "staff-2" }, false));
    expect(screen.queryByText("Hàng sắp hết")).not.toBeInTheDocument();
    expect(await screen.findByText(NOTIFICATION_LABELS.empty)).toBeInTheDocument();
  });

  it("logout with the dropdown open removes the inbox and stops personal requests", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: page });
    mount();
    await openBell();
    expect(await screen.findByText("Hàng sắp hết")).toBeInTheDocument();
    const before = get.mock.calls.length;
    act(() => useAuthStore.getState().logout(false));
    expect(screen.queryByText("Hàng sắp hết")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: NOTIFICATION_LABELS.trigger })).toBeNull();
    expect(get.mock.calls.length).toBe(before);
  });

  it("an anonymous session renders no bell and fetches nothing", async () => {
    useAuthStore.getState().logout(false);
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: page });
    mount();
    await act(async () => {});
    expect(screen.queryByRole("button", { name: /Thông báo|chưa đọc/ })).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("an inbox failure shows an error with a working retry", async () => {
    let fail = true;
    vi.spyOn(api, "get").mockImplementation(async () => {
      if (fail) throw new ApiError(503, "HTTP_503", "Service unavailable");
      return { data: page };
    });
    mount();
    const user = await openBell(0);
    expect(await screen.findByRole("alert")).toHaveTextContent(NOTIFICATION_LABELS.error);
    fail = false;
    await user.click(screen.getByRole("button", { name: NOTIFICATION_LABELS.retry }));
    expect(await screen.findByText("Hàng sắp hết")).toBeInTheDocument();
  });
});
