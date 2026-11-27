import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CHAT_PERMISSIONS } from "@/constants";
import { bePage, mockApi, renderScreen } from "@/test/api-screen";
import { pickOption } from "@/test/ui-actions";

import { ChatConversationScreen, ChatInbox } from "..";
import {
  CONVERSATION_ID,
  CUSTOMER_ID,
  QUOTE_ID,
  conversation,
  customerText,
  internalNote,
  messagePage,
  overview,
} from "../__fixtures__/chat";
import { staffConversationTools } from "../lifecycle";
import { attachableDocuments } from "../selectors";
import { chatCustomerOverviewSchema } from "../schemas";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const BASE = `/chat/conversations/${CONVERSATION_ID}`;
/** `renderScreen` signs in as this user. */
const AGENT_ME = "u-test";
const AGENT_OTHER = "a1a1a1a1-0000-4000-8000-000000000009";

const overviewWithQuote = {
  ...overview,
  quotes: [{ id: QUOTE_ID, customerId: CUSTOMER_ID, number: "QT-20261120-9001", status: "DRAFT" }],
};

function renderConversation(
  get: Record<string, () => unknown> = {},
  post: Record<string, (params: unknown, body?: unknown) => unknown> = {},
) {
  const api = mockApi("SALES_STAFF", {
    get: {
      [BASE]: () => ({ ...conversation, assignedAgentId: AGENT_ME }),
      [`${BASE}/messages`]: () => messagePage([customerText]),
      [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overviewWithQuote,
      ...get,
    },
    post,
  });
  renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
  return api;
}

describe("công cụ hội thoại — quyền (UI-only, BE kiểm lại)", () => {
  const can = (codes: string[]) => (code: string) => codes.includes(code);
  const sale = [CHAT_PERMISSIONS.update, CHAT_PERMISSIONS.cannedRead];

  it("hội thoại đã có người: Sale chuyển được, không phân công", () => {
    const tools = staffConversationTools(
      { status: "ACTIVE", assignedAgentId: AGENT_ME },
      AGENT_ME,
      can(sale),
    );
    expect(tools).toEqual({
      assign: false,
      transfer: true,
      createQuote: true,
      attach: true,
      canned: true,
    });
  });

  it("chưa ai nhận: chỉ người giám sát phân công (S11)", () => {
    const open = { status: "QUEUED" as const, assignedAgentId: null };
    expect(staffConversationTools(open, AGENT_ME, can(sale)).assign).toBe(false);
    expect(
      staffConversationTools(open, AGENT_ME, can([...sale, CHAT_PERMISSIONS.supervise])).assign,
    ).toBe(true);
  });

  it("đã kết thúc: không chuyển, không câu mẫu; vẫn gắn chứng từ (S13 không kiểm trạng thái)", () => {
    const tools = staffConversationTools(
      { status: "CLOSED", assignedAgentId: AGENT_ME },
      AGENT_ME,
      can(sale),
    );
    expect(tools).toEqual({
      assign: false,
      transfer: false,
      createQuote: false,
      attach: true,
      canned: false,
    });
  });

  it("chỉ đọc: không công cụ nào", () => {
    const tools = staffConversationTools(
      { status: "ACTIVE", assignedAgentId: AGENT_ME },
      AGENT_ME,
      can([CHAT_PERMISSIONS.read]),
    );
    expect(tools).toEqual({
      assign: false,
      transfer: false,
      createQuote: false,
      attach: false,
      canned: false,
    });
  });
});

describe("gắn chứng từ — chỉ chứng từ của chính khách (16 BR-02)", () => {
  it("đọc danh sách theo loại từ hồ sơ khách (S16)", () => {
    const parsed = chatCustomerOverviewSchema.parse({
      ...overviewWithQuote,
      designs: [{ id: "d-1", name: "Ly giấy 12oz logo xanh", status: "APPROVED" }],
    });
    expect(attachableDocuments(parsed, "QUOTE")).toEqual([
      { id: QUOTE_ID, label: "QT-20261120-9001 · DRAFT" },
    ]);
    expect(attachableDocuments(parsed, "DESIGN")).toEqual([
      { id: "d-1", label: "Ly giấy 12oz logo xanh · APPROVED" },
    ]);
    expect(attachableDocuments(undefined, "ORDER")).toEqual([]);
  });

  it("gửi {kind, id} tới /contexts", async () => {
    const api = renderConversation({}, { [`${BASE}/contexts`]: () => conversation });
    await userEvent.click(await screen.findByRole("button", { name: "Gắn chứng từ" }));
    const dialog = await screen.findByRole("dialog");
    await pickOption(
      userEvent.setup(),
      within(dialog).getByLabelText(/^Chứng từ/),
      /QT-20261120-9001/,
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Gắn" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${BASE}/contexts`, { kind: "QUOTE", id: QUOTE_ID }),
    );
  });
});

describe("chuyển hội thoại (S11, S15)", () => {
  it("danh sách bỏ người đang phụ trách; gửi {agentId, note}", async () => {
    const api = renderConversation(
      {
        "/chat/agents": () => [
          { userId: AGENT_ME, name: "Sale đang phụ trách", online: true },
          { userId: AGENT_OTHER, name: "Sale B", online: false },
        ],
      },
      { [`${BASE}/assignment`]: () => conversation },
    );
    await userEvent.click(await screen.findByRole("button", { name: "Chuyển cho Sale khác" }));
    const dialog = await screen.findByRole("dialog");
    const select = within(dialog).getByLabelText(/Sale nhận/);
    await waitFor(() => expect(select).toBeEnabled()); // danh sách Sale đã tải
    await userEvent.click(select);
    // chỉ còn Sale B — người đang phụ trách bị bỏ khỏi danh sách
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.queryByRole("option", { name: /Sale đang phụ trách/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: /Sale B/ }));
    await userEvent.type(within(dialog).getByLabelText(/Ghi chú cho người nhận/), "Khách hỏi giá");
    await userEvent.click(within(dialog).getByRole("button", { name: "Chuyển" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${BASE}/assignment`, {
        agentId: AGENT_OTHER,
        note: "Khách hỏi giá",
      }),
    );
  });
});

describe("câu trả lời mẫu (S23, S24)", () => {
  it("chọn câu mẫu → BE điền biến → vào ô trả lời, chưa gửi", async () => {
    const api = renderConversation({
      "/chat/canned-responses": () => [
        { id: "cr-1", title: "Chào khách", body: "Chào {customerName}", shared: true },
      ],
      [`${BASE}/canned-responses/cr-1/preview`]: () => ({
        cannedResponseId: "cr-1",
        conversationId: CONVERSATION_ID,
        text: "Chào Khách hàng demo",
      }),
    });
    await userEvent.click(await screen.findByRole("button", { name: /Câu trả lời mẫu/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Chào khách/ }));
    await waitFor(() =>
      expect(screen.getByLabelText("Tin nhắn cho khách")).toHaveValue("Chào Khách hàng demo"),
    );
    expect(api.post).not.toHaveBeenCalledWith(`${BASE}/messages`, expect.anything());
  });
});

describe("tìm trong tin nhắn (S21)", () => {
  it("URL q → gọi /chat/search, hiện tin (ghi chú nội bộ đánh dấu) và link hội thoại", async () => {
    const api = mockApi("SALES_STAFF", {
      get: {
        "/chat/search": () =>
          bePage([
            {
              message: internalNote,
              conversationId: CONVERSATION_ID,
              customerId: CUSTOMER_ID,
              customerName: "Khách hàng demo",
              subject: "Báo giá ly logo xanh",
              conversationStatus: "ACTIVE",
            },
          ]),
      },
    });
    renderScreen(<ChatInbox />, "SALES_STAFF", "?q=goi%20lai");
    const link = await screen.findByRole("link", { name: /Báo giá ly logo xanh/ });
    expect(link).toHaveAttribute("href", `/admin/chat/${CONVERSATION_ID}`);
    expect(within(link).getByText("Ghi chú nội bộ")).toBeInTheDocument();
    const call = api.get.mock.calls.find((c) => c[0] === "/chat/search")?.[1] as {
      params: { q: string; page: number };
    };
    expect(call.params).toMatchObject({ q: "goi lai", page: 0 });
  });

  it("dưới 2 ký tự: không gọi tìm kiếm, vẫn là hộp thư", async () => {
    const api = mockApi("SALES_STAFF", { get: { "/chat/conversations": () => bePage([]) } });
    renderScreen(<ChatInbox />, "SALES_STAFF", "?q=a");
    expect(await screen.findByText("Chưa có hội thoại")).toBeInTheDocument();
    expect(api.get.mock.calls.some((c) => c[0] === "/chat/search")).toBe(false);
  });
});
