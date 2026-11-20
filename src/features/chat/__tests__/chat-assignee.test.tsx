import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CHAT_PERMISSIONS } from "@/constants";
import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { ChatConversationScreen } from "..";
import {
  CONVERSATION_ID,
  CUSTOMER_ID,
  conversation,
  customerText,
  messagePage,
  overview,
  quoteRequestCard,
} from "../__fixtures__/chat";
import {
  inCharge,
  notInChargeHint,
  staffConversationActions,
  staffConversationTools,
} from "../lifecycle";
import { chatErrorMessage } from "../mutations";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const BASE = `/chat/conversations/${CONVERSATION_ID}`;
const ME = "u-test";
const OTHER = "a1a1a1a1-0000-4000-8000-000000000005";
const can = (codes: string[]) => (code: string) => codes.includes(code);
const sale = [CHAT_PERMISSIONS.update, CHAT_PERMISSIONS.cannedRead];
const supervisor = [...sale, CHAT_PERMISSIONS.supervise];
const active = { status: "ACTIVE" as const, nextStatuses: ["RESOLVED" as const] };

describe("inCharge — người phụ trách hoặc giám sát (BE requireInCharge)", () => {
  it.each([
    ["chính mình", ME, sale, true],
    ["người khác, không giám sát", OTHER, sale, false],
    ["người khác nhưng là giám sát", OTHER, supervisor, true],
    ["chưa ai phụ trách, không giám sát", null, sale, false],
    ["chưa ai phụ trách, giám sát", null, supervisor, true],
  ])("%s", (_name, assignee, codes, expected) => {
    expect(inCharge({ assignedAgentId: assignee }, ME, can(codes))).toBe(expected);
  });

  it("chưa đăng nhập (meId null) không bao giờ khớp người phụ trách", () => {
    expect(inCharge({ assignedAgentId: null }, null, can(sale))).toBe(false);
  });
});

describe("quyền theo người phụ trách", () => {
  it("không phụ trách: không trả lời, không đổi trạng thái, không chuyển, không lập báo giá; ghi chú vẫn được", () => {
    const conv = { ...active, assignedAgentId: OTHER };
    expect(staffConversationActions(conv, ME, can(sale))).toEqual({
      claim: false,
      reply: false,
      note: true,
      moves: [],
    });
    expect(staffConversationTools(conv, ME, can(sale))).toMatchObject({
      assign: false,
      transfer: false,
      createQuote: false,
    });
  });

  it("giám sát: mọi việc bật, kể cả chuyển và lập báo giá", () => {
    const conv = { ...active, assignedAgentId: OTHER };
    expect(staffConversationActions(conv, ME, can(supervisor))).toMatchObject({
      reply: true,
      moves: ["RESOLVED"],
    });
    expect(staffConversationTools(conv, ME, can(supervisor))).toMatchObject({
      transfer: true,
      createQuote: true,
    });
  });

  it("chưa ai phụ trách: chỉ giám sát phân công được", () => {
    const conv = { status: "QUEUED" as const, assignedAgentId: null };
    expect(staffConversationTools(conv, ME, can(sale)).assign).toBe(false);
    expect(staffConversationTools(conv, ME, can(supervisor)).assign).toBe(true);
  });

  it("câu giải thích nêu tên người đang phụ trách", () => {
    expect(
      notInChargeHint({ assignedAgentId: OTHER, assignedAgentName: "Sale B" }, ME, can(sale)),
    ).toBe("Hội thoại do Sale B phụ trách — nhờ người giám sát chat chuyển cho bạn.");
    expect(
      notInChargeHint({ assignedAgentId: ME, assignedAgentName: "Tôi" }, ME, can(sale)),
    ).toBeNull();
  });
});

describe("CHAT_NOT_ASSIGNEE", () => {
  it("có câu tiếng Việt riêng", () => {
    expect(
      chatErrorMessage(apiError(409, "CHAT_NOT_ASSIGNEE", undefined, "Not the assignee")),
    ).toBe("Chỉ người phụ trách hội thoại hoặc người giám sát chat làm được việc này.");
  });
});

describe("màn hình hội thoại của Sale B", () => {
  function renderOthers() {
    const api = mockApi("SALES_STAFF", {
      get: {
        [BASE]: () => ({ ...conversation, assignedAgentId: OTHER, assignedAgentName: "Sale B" }),
        [`${BASE}/messages`]: () => messagePage([quoteRequestCard(["CREATE_QUOTE"]), customerText]),
        [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overview,
      },
    });
    renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
    return api;
  }

  it("nút 'Lập báo giá' tắt kèm câu hướng dẫn, POST không được gọi", async () => {
    const api = renderOthers();
    const button = await screen.findByRole("button", { name: /Lập báo giá/ });
    expect(button).toBeDisabled();
    expect(
      screen.getAllByText("Hội thoại do Sale B phụ trách — nhờ người giám sát chat chuyển cho bạn.")
        .length,
    ).toBeGreaterThan(0);
    await userEvent.click(button);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("ô soạn tin chỉ còn ghi chú nội bộ; không có đổi trạng thái; nút chuyển tắt", async () => {
    renderOthers();
    await screen.findByRole("button", { name: /Lập báo giá/ });
    expect(screen.queryByRole("radio", { name: "Trả lời khách" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Ghi chú nội bộ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đã giải quyết" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Chuyển cho Sale khác" })).toBeDisabled(),
    );
    expect(
      screen.queryByRole("button", { name: "Gửi thông tin chuyển khoản" }),
    ).not.toBeInTheDocument();
  });
});
