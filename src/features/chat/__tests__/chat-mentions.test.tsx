import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

import { ChatConversationScreen } from "..";
import {
  CONVERSATION_ID,
  conversation,
  customerText,
  internalNote,
  messagePage,
  overview,
} from "../__fixtures__/chat";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  // jsdom has no ResizeObserver / scrollIntoView, which `cmdk` uses
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => vi.restoreAllMocks());

const BASE = `/chat/conversations/${CONVERSATION_ID}`;
const STAFF_ID = "11111111-1111-4111-8111-111111111111";
const staff = [
  {
    id: STAFF_ID,
    name: "Lê Kế Toán",
    role: "ACCOUNTANT",
    roleName: "Kế toán",
    roles: [{ code: "ACCOUNTANT", name: "Kế toán" }],
  },
];

const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const second = { ...staff[0], id: SECOND_ID, name: "Lê Thủ Kho", roleName: "Thủ kho" };
const other = { ...staff[0], id: "33333333-3333-4333-8333-333333333333", name: "Phạm Giám Đốc" };

function renderConversation(items: unknown[], directory: unknown[] = staff) {
  const api = mockApi("SALES_STAFF", {
    get: {
      [BASE]: () => ({ ...conversation, assignedAgentId: "u-test" }),
      [`${BASE}/messages`]: () => messagePage(items),
      [`/chat/customers/${conversation.customerId}/overview`]: () => overview,
      "/chat/staff": (params: unknown) =>
        (params as { q?: string } | undefined)?.q === "Ph" ? [other] : directory,
    },
    post: { [`${BASE}/notes`]: () => ({ ...internalNote, id: "m-new", seq: 9 }) },
  });
  renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
  return api;
}

describe("BO-18 — @nhắc trong ghi chú nội bộ", () => {
  it("gõ '@' tìm /chat/staff?q=, chọn thì chèn '@Tên' và gửi id trong mentions", async () => {
    const api = renderConversation([customerText]);
    await userEvent.click(await screen.findByRole("radio", { name: "Ghi chú nội bộ" }));
    const box = screen.getByLabelText("Ghi chú nội bộ");
    await userEvent.type(box, "Nhờ @Lê");
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        "/chat/staff",
        expect.objectContaining({ params: { q: "Lê", limit: 20 } }),
      ),
    );
    await userEvent.click(await screen.findByRole("option", { name: /Lê Kế Toán/ }));
    expect(box).toHaveValue("Nhờ @Lê Kế Toán ");
    await userEvent.type(box, "xem giúp");
    await userEvent.click(screen.getByRole("button", { name: "Lưu ghi chú nội bộ" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `${BASE}/notes`,
        expect.objectContaining({ text: "Nhờ @Lê Kế Toán xem giúp", mentions: [STAFF_ID] }),
      ),
    );
  });

  it("↑/↓ + Enter chọn người; xoá '@Tên' khỏi ghi chú thì không gửi id đó", async () => {
    const api = renderConversation([customerText]);
    await userEvent.click(await screen.findByRole("radio", { name: "Ghi chú nội bộ" }));
    const box = screen.getByLabelText("Ghi chú nội bộ");
    await userEvent.type(box, "@");
    await screen.findByRole("option", { name: /Lê Kế Toán/ });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(box).toHaveValue("@Lê Kế Toán ");
    await userEvent.clear(box);
    await userEvent.type(box, "Không nhắc ai");
    await userEvent.click(screen.getByRole("button", { name: "Lưu ghi chú nội bộ" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `${BASE}/notes`,
        expect.objectContaining({ mentions: [] }),
      ),
    );
  });

  it("ghi chú có mentions hiện 'Nhắc N người' (BE chỉ trả id); tin khác không hiện", async () => {
    renderConversation([{ ...internalNote, mentions: [STAFF_ID, "u-2"] }, customerText]);
    expect(await screen.findByText("Nhắc 2 người")).toBeInTheDocument();
    expect(screen.getAllByText(/^Nhắc /)).toHaveLength(1);
  });

  it("ArrowDown một lần chọn dòng thứ hai, Enter lấy đúng dòng đó; đổi từ khoá thì Enter lấy dòng đầu đang hiện", async () => {
    const api = renderConversation([customerText], [staff[0], second]);
    await userEvent.click(await screen.findByRole("radio", { name: "Ghi chú nội bộ" }));
    const box = screen.getByLabelText("Ghi chú nội bộ");
    await userEvent.type(box, "@");
    await screen.findByRole("option", { name: /Lê Thủ Kho/ });
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /Lê Thủ Kho/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{Enter}");
    expect(box).toHaveValue("@Lê Thủ Kho ");
    await userEvent.type(box, "và @Ph");
    await screen.findByRole("option", { name: /Phạm Giám Đốc/ });
    await userEvent.keyboard("{Enter}");
    expect(box).toHaveValue("@Lê Thủ Kho và @Phạm Giám Đốc ");
    await userEvent.type(box, "ok");
    await userEvent.click(screen.getByRole("button", { name: "Lưu ghi chú nội bộ" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `${BASE}/notes`,
        expect.objectContaining({ mentions: [SECOND_ID, other.id] }),
      ),
    );
  });

  it("ô soạn có ngữ nghĩa combobox khi danh sách mở; Esc và rời ô đóng danh sách", async () => {
    renderConversation([customerText], [staff[0], second]);
    await userEvent.click(await screen.findByRole("radio", { name: "Ghi chú nội bộ" }));
    const box = screen.getByLabelText("Ghi chú nội bộ");
    expect(box).not.toHaveAttribute("role", "combobox");
    await userEvent.type(box, "@");
    const first = await screen.findByRole("option", { name: /Lê Kế Toán/ });
    const list = screen.getByRole("listbox");
    expect(box).toHaveAttribute("role", "combobox");
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(box).toHaveAttribute("aria-autocomplete", "list");
    const controlled = document.getElementById(box.getAttribute("aria-controls") ?? "");
    expect(controlled).toContainElement(list);
    expect(box).toHaveAttribute("aria-activedescendant", first.id);
    await userEvent.keyboard("{ArrowDown}");
    expect(box).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /Lê Thủ Kho/ }).id,
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.type(box, " @");
    await screen.findByRole("listbox");
    await userEvent.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
