import { describe, expect, it } from "vitest";

import { notificationPageDto } from "./schemas";

/** Matches UserNotificationPageResponse in BE PR #102, including omitted nulls. */
const response = {
  items: [
    {
      id: "77777777-7777-4777-8777-777777777777",
      category: "INVENTORY_ALERT",
      severity: "CRITICAL",
      title: "Hàng cần xử lý",
      link: "/admin/inventory/alerts?kind=EXPIRED",
      sourceType: "STOCK_ALERT",
      sourceId: "66666666-6666-4666-8666-666666666666",
      createdAt: "2026-10-15T01:00:00Z",
      read: false,
    },
  ],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
  unreadCount: 1,
};

describe("SCRUM-147 BE response contract", () => {
  it("accepts an inbox page with optional fields omitted", () => {
    expect(notificationPageDto.parse(response)).toEqual(response);
  });

  it("accepts explicit nulls and a read timestamp", () => {
    const item = { ...response.items[0], read: true, readAt: "2026-10-16T12:00:00Z", body: null };
    expect(notificationPageDto.parse({ ...response, items: [item] }).items[0]?.readAt).toBe(
      item.readAt,
    );
  });

  it.each(["https://outside.test", "//outside.test", "/\\outside.test", "javascript:alert(1)"])(
    "rejects a non-local link %s",
    (link) => {
      expect(() =>
        notificationPageDto.parse({ ...response, items: [{ ...response.items[0], link }] }),
      ).toThrow();
    },
  );

  it("rejects unknown severity and missing mandatory counts", () => {
    expect(() =>
      notificationPageDto.parse({
        ...response,
        items: [{ ...response.items[0], severity: "HIGH" }],
      }),
    ).toThrow();
    expect(() => notificationPageDto.parse({ ...response, unreadCount: undefined })).toThrow();
  });
});
