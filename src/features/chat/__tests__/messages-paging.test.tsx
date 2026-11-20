import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

import { ChatConversationScreen } from "..";
import {
  CONVERSATION_ID,
  CUSTOMER_ID,
  conversation,
  customerText,
  overview,
} from "../__fixtures__/chat";
import { chatMessagePageSchema } from "../schemas";
import { mergeMessages, shouldStickToBottom } from "../selectors";
import { useChatScroll } from "../use-chat-scroll";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const BASE = `/chat/conversations/${CONVERSATION_ID}`;
const text = (seq: number) => ({ ...customerText, id: `m-${seq}`, seq, body: `Tin số ${seq}` });

describe("Tải tin cũ hơn", () => {
  function renderPaged(latestNextBefore: number | undefined) {
    const api = mockApi("SALES_STAFF", {
      get: {
        [BASE]: () => ({ ...conversation, assignedAgentId: "u-test" }),
        [`${BASE}/messages`]: (params) =>
          (params as { before?: string }).before
            ? { items: [text(49), text(50)], lastSeq: 60 }
            : {
                items: [text(51), text(52)],
                ...(latestNextBefore ? { nextBefore: latestNextBefore } : {}),
                lastSeq: 60,
              },
        [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overview,
      },
    });
    renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
    return api;
  }

  it("bấm Tải tin cũ hơn gọi before=<nextBefore>; tin cũ hiện phía trên, không trùng", async () => {
    const api = renderPaged(51);
    await userEvent.click(await screen.findByRole("button", { name: "Tải tin cũ hơn" }));
    expect(await screen.findByText("Tin số 49")).toBeInTheDocument();
    const call = api.get.mock.calls.find(
      (c) => c[0] === `${BASE}/messages` && (c[1] as { params: { before?: string } }).params.before,
    );
    expect((call?.[1] as { params: { before: string } }).params.before).toBe("51");
    const order = screen.getAllByText(/^Tin số/).map((el) => el.textContent);
    expect(order).toEqual(["Tin số 49", "Tin số 50", "Tin số 51", "Tin số 52"]);
    // trang cũ hết (không có nextBefore) → nút biến mất
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Tải tin cũ hơn" })).not.toBeInTheDocument(),
    );
  });

  it("không có nextBefore → không có nút", async () => {
    renderPaged(undefined);
    expect(await screen.findByText("Tin số 52")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải tin cũ hơn" })).not.toBeInTheDocument();
  });
});

describe("mergeMessages", () => {
  const parse = (items: unknown[]) => chatMessagePageSchema.parse({ items, lastSeq: 9 }).items;
  it("khử trùng theo seq (trang mới nhất thắng) và sắp theo thời gian", () => {
    const latest = parse([{ ...text(3), body: "mới" }, text(4)]);
    const older = parse([text(1), text(2), text(3)]);
    const merged = mergeMessages(latest, [older]);
    expect(merged.map((m) => m.seq)).toEqual([1, 2, 3, 4]);
    expect(merged[2]?.body).toBe("mới");
  });
});

describe("shouldStickToBottom", () => {
  it("cách đáy dưới 48px là ở cuối", () => {
    expect(shouldStickToBottom({ scrollHeight: 1000, scrollTop: 460, clientHeight: 500 })).toBe(
      true,
    );
    expect(shouldStickToBottom({ scrollHeight: 1000, scrollTop: 400, clientHeight: 500 })).toBe(
      false,
    );
  });
});

/** jsdom không có bố cục: dựng <ol> với hình học giả. */
function Harness({ newest, oldest, mine }: { newest: number; oldest: number; mine: boolean }) {
  const { listRef, onScroll, unseen, rememberHeight } = useChatScroll(newest, oldest, mine);
  return (
    <div>
      <ol ref={listRef} onScroll={onScroll} data-testid="list" />
      <button type="button" onClick={rememberHeight}>
        remember
      </button>
      {unseen && <span>Có tin mới</span>}
    </div>
  );
}

function fakeGeometry(el: HTMLElement, box: { height: number; top: number; client: number }) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => box.height });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => box.client });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => box.top,
    set: (value: number) => {
      box.top = value;
    },
  });
}

describe("tự cuộn", () => {
  function scrolled(box: { height: number; top: number; client: number }, mine = false) {
    const view = render(<Harness newest={10} oldest={5} mine={false} />);
    const list = view.getByTestId("list");
    fakeGeometry(list, box);
    act(() => {
      list.dispatchEvent(new Event("scroll"));
    });
    return { ...view, list, mine };
  }

  it("đang đọc tin cũ thì tin mới không kéo xuống, chỉ hiện chip", () => {
    const { rerender, list } = scrolled({ height: 1000, top: 100, client: 500 });
    rerender(<Harness newest={11} oldest={5} mine={false} />);
    expect(list.scrollTop).toBe(100);
    expect(screen.getByText("Có tin mới")).toBeInTheDocument();
  });

  it("đang ở cuối thì tin mới kéo xuống cuối", () => {
    const { rerender, list } = scrolled({ height: 1000, top: 500, client: 500 });
    rerender(<Harness newest={11} oldest={5} mine={false} />);
    expect(list.scrollTop).toBe(1000);
    expect(screen.queryByText("Có tin mới")).not.toBeInTheDocument();
  });

  it("tin mới do chính mình gửi kéo xuống dù đang đọc phía trên", () => {
    const { rerender, list } = scrolled({ height: 1000, top: 100, client: 500 });
    rerender(<Harness newest={11} oldest={5} mine />);
    expect(list.scrollTop).toBe(1000);
  });

  it("chèn tin cũ phía trên thì bù chiều cao, giữ nguyên chỗ đang đọc", () => {
    const box = { height: 1000, top: 0, client: 500 };
    const { rerender, list } = scrolled(box);
    act(() => screen.getByText("remember").click());
    box.height = 1400; // 400px tin cũ chèn lên đầu
    rerender(<Harness newest={10} oldest={1} mine={false} />);
    expect(list.scrollTop).toBe(400);
  });
});
