import { describe, expect, it } from "vitest";

import { notificationPageDto } from "./schemas";

/** Matches UserNotificationPageResponse in BE PR #102, including omitted nulls. */
const response = {
  items: [
    {
      id: "77777777-7777-4777-8777-777777777777",
      category: "PAYMENT_OVERDUE",
      severity: "WARN",
      title: "Khách có đợt thanh toán quá hạn: hợp đồng HD-20261108-000016-1, đợt 1",
      link: "/admin/orders/0e380000-0000-4000-8000-000000000201",
      sourceType: "INSTALLMENT",
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

  it.each([
    "https://outside.test",
    "//outside.test",
    "/\\outside.test",
    "javascript:alert(1)",
    "/\t/outside.test",
    "/login",
    42,
  ])("drops unsafe link %s to null without rejecting the rest of the page", (link) => {
    const healthy = { ...response.items[0], id: "88888888-8888-4888-8888-888888888888" };
    const page = notificationPageDto.parse({
      ...response,
      items: [{ ...response.items[0], link }, healthy],
    });
    expect(page.items.map((item) => item.link)).toEqual([null, healthy.link]);
  });

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
