import { afterEach, describe, expect, it, vi } from "vitest";

import { NOTIFICATION_API } from "@/constants/notifications";

import { api } from "@/lib/api/client";

import {
  getMyUnreadCount,
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "./api";

const emptyPage = {
  items: [],
  page: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
  unreadCount: 2,
};

afterEach(() => vi.restoreAllMocks());

describe("SCRUM-147 API boundary", () => {
  it("lists only the caller's inbox with 0-based params and seeds unreadCount", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: emptyPage });
    const result = await listMyNotifications({ page: 0, size: 10, unreadOnly: true });
    expect(result.unreadCount).toBe(2);
    expect(get.mock.calls[0]?.[0]).toBe(NOTIFICATION_API.inbox);
    expect(get.mock.calls[0]?.[1]?.params).toEqual({ page: 0, size: 10, unreadOnly: true });
  });

  it("fetches count for polling and validates response", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: { unreadCount: 4 } });
    expect(await getMyUnreadCount()).toBe(4);
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: { count: 4 } });
    await expect(getMyUnreadCount()).rejects.toThrow();
  });

  it("uses POST with no body for idempotent mark-read (204) and mark-all-read", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({ status: 204 })
      .mockResolvedValueOnce({ data: { updated: 3 } });
    const id = "77777777-7777-4777-8777-777777777777";
    await markMyNotificationRead(id);
    expect(post.mock.calls[0]?.[0]).toBe(NOTIFICATION_API.markRead(id));
    expect(await markAllMyNotificationsRead()).toBe(3);
    expect(post.mock.calls[1]?.[0]).toBe(NOTIFICATION_API.markAllRead);
  });

  it("rejects out-of-range paging before any network call", async () => {
    const get = vi.spyOn(api, "get");
    await expect(listMyNotifications({ page: -1, size: 201, unreadOnly: false })).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });
});
