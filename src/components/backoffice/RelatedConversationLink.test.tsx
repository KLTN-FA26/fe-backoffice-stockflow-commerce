import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";

import { RelatedConversationLink } from "./RelatedConversationLink";

afterEach(() => vi.restoreAllMocks());

const paramsOf = (call: unknown[]) =>
  new URLSearchParams((call[1] as { params: URLSearchParams }).params);

describe("RelatedConversationLink", () => {
  it("đơn có hội thoại → link tới hội thoại, lọc theo contextKind=ORDER + contextId", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/chat/conversations": () => bePage([{ id: "cv-1" }]) },
    });
    renderScreen(
      <RelatedConversationLink target={{ kind: "ORDER", id: "ord-1" }} />,
      "SALES_STAFF",
    );

    const link = await screen.findByRole("link", { name: "Hội thoại liên quan" });
    expect(link).toHaveAttribute("href", "/admin/chat/cv-1");
    const params = paramsOf(api.get.mock.calls.find(([url]) => url === "/chat/conversations")!);
    expect(params.get("contextKind")).toBe("ORDER");
    expect(params.get("contextId")).toBe("ord-1");
    expect(params.getAll("status").length).toBeGreaterThan(0);
  });

  it("báo giá → contextKind=QUOTE", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/chat/conversations": () => bePage([{ id: "cv-2" }]) },
    });
    renderScreen(<RelatedConversationLink target={{ kind: "QUOTE", id: "q-1" }} />, "SALES_STAFF");

    await screen.findByRole("link", { name: "Hội thoại liên quan" });
    const params = paramsOf(api.get.mock.calls.find(([url]) => url === "/chat/conversations")!);
    expect(params.get("contextKind")).toBe("QUOTE");
    expect(params.get("contextId")).toBe("q-1");
  });

  it("khách → lọc theo customerId, không gửi contextKind", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/chat/conversations": () => bePage([{ id: "cv-3" }]) },
    });
    renderScreen(
      <RelatedConversationLink target={{ kind: "CUSTOMER", id: "c-1" }} />,
      "SALES_STAFF",
    );

    await screen.findByRole("link", { name: "Hội thoại liên quan" });
    const params = paramsOf(api.get.mock.calls.find(([url]) => url === "/chat/conversations")!);
    expect(params.get("customerId")).toBe("c-1");
    expect(params.has("contextKind")).toBe(false);
  });

  it("chưa có hội thoại → không hiện gì", async () => {
    const api = mockApi("SALES_STAFF", { get: { "/chat/conversations": () => bePage([]) } });
    renderScreen(
      <RelatedConversationLink target={{ kind: "ORDER", id: "ord-1" }} />,
      "SALES_STAFF",
    );

    await waitFor(() =>
      expect(api.get.mock.calls.some(([url]) => url === "/chat/conversations")).toBe(true),
    );
    expect(screen.queryByRole("link", { name: "Hội thoại liên quan" })).not.toBeInTheDocument();
  });

  it("không có chat-conversations:READ → không gọi BE, không hiện link", async () => {
    const api = mockApi("WAREHOUSE_STAFF", {
      get: { "/chat/conversations": () => bePage([{ id: "cv-1" }]) },
    });
    renderScreen(
      <RelatedConversationLink target={{ kind: "ORDER", id: "ord-1" }} />,
      "WAREHOUSE_STAFF",
    );

    await waitFor(() =>
      expect(api.get.mock.calls.some(([url]) => url === "/identity/me/permissions")).toBe(true),
    );
    expect(screen.queryByRole("link", { name: "Hội thoại liên quan" })).not.toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => url === "/chat/conversations")).toBe(false);
  });
});
