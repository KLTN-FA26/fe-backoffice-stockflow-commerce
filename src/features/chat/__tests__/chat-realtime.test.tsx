import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHAT_BADGE_POLL_MS, CHAT_LIVE_POLL_MS, CHAT_POLL_MS } from "@/constants";
import { toast } from "@/components/shared/Toast";
import { bePage, mockApi, renderScreen } from "@/test/api-screen";

import { ChatConversationScreen, ChatInbox, useStaffChatBadge } from "..";
import {
  CONVERSATION_ID,
  CUSTOMER_ID,
  conversation,
  customerText,
  internalNote,
  messagePage,
  overview,
} from "../__fixtures__/chat";
import { chatPollInterval } from "../polling";
import { chatKeys } from "../queries";
import { replaceInboxRow, replaceMessageInPages, upsertMessage } from "../realtime-cache";
import { chatConversationSchema, chatMessagePageSchema, chatMessageSchema } from "../schemas";

/** A stand-in for the one chat socket (`lib/realtime`): screens subscribe; the test emits and flips the status. */
const socket = vi.hoisted(() => ({
  live: false,
  listeners: new Map<string, Set<(event: unknown) => void>>(),
  statusSubscribers: new Set<() => void>(),
}));
vi.mock("@/lib/realtime", async () => {
  const { useEffect, useRef, useSyncExternalStore } = await import("react");
  return {
    useChatSocketStatus: () =>
      useSyncExternalStore(
        (notify: () => void) => {
          socket.statusSubscribers.add(notify);
          return () => socket.statusSubscribers.delete(notify);
        },
        () => socket.live,
      ),
    useChatSubscription: (destination: string | null, listener: (event: unknown) => void) => {
      const latest = useRef(listener);
      useEffect(() => {
        latest.current = listener;
      });
      useEffect(() => {
        if (!destination) return;
        const forward = (event: unknown) => latest.current(event);
        const set = socket.listeners.get(destination) ?? new Set();
        set.add(forward);
        socket.listeners.set(destination, set);
        return () => void set.delete(forward);
      }, [destination]);
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const BASE = `/chat/conversations/${CONVERSATION_ID}`;
const TOPIC = `/topic/chat.conversations.${CONVERSATION_ID}`;
const ME = "u-test";
const myConversation = { ...conversation, assignedAgentId: ME };

function emit(destination: string, event: unknown) {
  act(() => socket.listeners.get(destination)?.forEach((listener) => listener(event)));
}
function setLive(live: boolean) {
  act(() => {
    socket.live = live;
    socket.statusSubscribers.forEach((notify) => notify());
  });
}
const subscribed = (destination: string) => (socket.listeners.get(destination)?.size ?? 0) > 0;
const getsOf = (api: ReturnType<typeof mockApi>, url: string) =>
  api.get.mock.calls.filter(([called]) => called === url).length;

beforeEach(() => {
  socket.live = false;
  socket.listeners.clear();
  socket.statusSubscribers.clear();
});
afterEach(() => vi.restoreAllMocks());

const message = (over: Record<string, unknown>) =>
  chatMessageSchema.parse({ ...customerText, ...over });

describe("realtime cache updates (pure)", () => {
  const page = chatMessagePageSchema.parse(messagePage([internalNote, customerText]));

  it("upsertMessage adds a new message newest-first and raises lastSeq; replaces one it has by id", () => {
    const added = upsertMessage(page, message({ id: "m-4", seq: 4, body: "mới" }));
    expect(added?.items.map((item) => item.seq)).toEqual([4, 3, 2]);
    expect(added?.lastSeq).toBe(4);
    const edited = upsertMessage(page, message({ body: "đã sửa" }));
    expect(edited?.items).toHaveLength(2);
    expect(edited?.items.find((item) => item.id === customerText.id)?.body).toBe("đã sửa");
    expect(upsertMessage(undefined, message({}))).toBeUndefined();
  });

  it("replaceMessageInPages edits a message already loaded, and leaves pages without it alone", () => {
    const older = { pages: [page], pageParams: [0] };
    expect(replaceMessageInPages(older, message({ body: "x" }))?.pages[0]?.items[1]?.body).toBe(
      "x",
    );
    expect(replaceMessageInPages(older, message({ id: "other" }))).toBe(older);
  });

  it("replaceInboxRow takes the socket row but keeps the viewer's unread count and action flags", () => {
    const mine = chatConversationSchema.parse({ ...myConversation, unread: 2, canReply: true });
    const row = chatConversationSchema.parse({
      ...myConversation,
      subject: "Đổi chủ đề",
      unread: 0,
      nextStatuses: [],
    });
    const next = replaceInboxRow({ items: [mine] }, row);
    expect(next?.items[0]).toMatchObject({
      subject: "Đổi chủ đề",
      unread: 2,
      canReply: true,
      nextStatuses: mine.nextStatuses,
    });
    const other = { items: [mine] };
    expect(replaceInboxRow(other, { ...row, id: "khac" })).toBe(other);
  });

  it("polls every 5 s without a socket, and only as a 45 s safety net while it is up", () => {
    expect(chatPollInterval(false)).toBe(CHAT_POLL_MS);
    expect(chatPollInterval(true)).toBe(CHAT_LIVE_POLL_MS);
    expect(chatPollInterval(false, CHAT_BADGE_POLL_MS)).toBe(CHAT_BADGE_POLL_MS);
    expect(CHAT_LIVE_POLL_MS).toBeGreaterThanOrEqual(30_000);
    expect(CHAT_LIVE_POLL_MS).toBeLessThanOrEqual(60_000);
  });
});

function renderConversation() {
  const api = mockApi("SALES_STAFF", {
    get: {
      [BASE]: () => myConversation,
      [`${BASE}/messages`]: () => messagePage([internalNote, customerText]),
      [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overview,
    },
    post: { [`${BASE}/read`]: () => null },
  });
  const view = renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
  return { api, client: view.client };
}

const pollOf = (client: ReturnType<typeof renderConversation>["client"]) =>
  client.getQueryCache().find({ queryKey: chatKeys.messages(CONVERSATION_ID), exact: true })
    ?.observers[0]?.options.refetchInterval;

describe("open conversation over the socket (A.3)", () => {
  it("subscribes to the conversation's topic and staff topic once the GET found it", async () => {
    renderConversation();
    await screen.findByText("Em cần 60 thùng ạ");
    expect(subscribed(TOPIC)).toBe(true);
    expect(subscribed(`${TOPIC}.staff`)).toBe(true);
  });

  it("a message from the customer appears at once and the detail is read again", async () => {
    const { api } = renderConversation();
    await screen.findByText("Em cần 60 thùng ạ");
    const detailReads = getsOf(api, BASE);
    emit(TOPIC, {
      type: "message.created",
      conversationId: CONVERSATION_ID,
      data: { ...customerText, id: "m-5", seq: 5, body: "Cho em xin báo giá nhé" },
    });
    expect(await screen.findByText("Cho em xin báo giá nhé")).toBeInTheDocument();
    await waitFor(() => expect(getsOf(api, BASE)).toBeGreaterThan(detailReads));
  });

  it("an internal note arrives on the staff topic; an edited card replaces the card in place", async () => {
    renderConversation();
    await screen.findByText("Em cần 60 thùng ạ");
    emit(`${TOPIC}.staff`, {
      type: "message.created",
      conversationId: CONVERSATION_ID,
      data: { ...internalNote, id: "m-6", seq: 6, body: "Nhớ hỏi số lượng" },
    });
    expect(await screen.findByText("Nhớ hỏi số lượng")).toBeInTheDocument();
    emit(`${TOPIC}.staff`, {
      type: "message.updated",
      conversationId: CONVERSATION_ID,
      data: { ...internalNote, id: "m-6", seq: 6, body: "Nhớ hỏi số lượng (đã sửa)" },
    });
    expect(await screen.findByText("Nhớ hỏi số lượng (đã sửa)")).toBeInTheDocument();
    expect(screen.queryByText("Nhớ hỏi số lượng")).not.toBeInTheDocument();
  });

  it("conversation.updated (the customer's row) only makes the detail read again, never copies it", async () => {
    const { api } = renderConversation();
    await screen.findByText("Em cần 60 thùng ạ");
    const detailReads = getsOf(api, BASE);
    emit(TOPIC, {
      type: "conversation.updated",
      conversationId: CONVERSATION_ID,
      data: { ...myConversation, status: "CLOSED", nextStatuses: [] },
    });
    await waitFor(() => expect(getsOf(api, BASE)).toBe(detailReads + 1));
    // Status and buttons still from the staff GET: the conversation is ACTIVE there.
    expect(screen.getByText("Đang trao đổi")).toBeInTheDocument();
    expect(screen.queryByText("Đã đóng")).not.toBeInTheDocument();
  });

  it("ignores an event of another conversation", async () => {
    renderConversation();
    await screen.findByText("Em cần 60 thùng ạ");
    emit(TOPIC, {
      type: "message.created",
      conversationId: "khac",
      data: {
        ...customerText,
        id: "m-x",
        seq: 9,
        conversationId: "khac",
        body: "Không phải ở đây",
      },
    });
    expect(screen.queryByText("Không phải ở đây")).not.toBeInTheDocument();
  });

  it("polls fast while the socket is down and slowly while it is up; catching up on reconnect", async () => {
    const { api, client } = renderConversation();
    await screen.findByText("Em cần 60 thùng ạ");
    expect(pollOf(client)).toBe(CHAT_POLL_MS);
    const messageReads = getsOf(api, `${BASE}/messages`);
    setLive(true);
    expect(pollOf(client)).toBe(CHAT_LIVE_POLL_MS);
    await waitFor(() => expect(getsOf(api, `${BASE}/messages`)).toBe(messageReads + 1));
    setLive(false);
    expect(pollOf(client)).toBe(CHAT_POLL_MS);
  });
});

function Badge() {
  const count = useStaffChatBadge();
  return <output aria-label="Huy hiệu chat">{count}</output>;
}

describe("staff queue over the socket (A.3)", () => {
  function renderInbox(unread = 2) {
    const row = { ...myConversation, unread };
    const api = mockApi("SALES_STAFF", {
      get: {
        "/chat/conversations": () => bePage([row]),
        "/chat/unread-count": () => ({ conversations: 1, messages: unread, queued: 0 }),
      },
    });
    renderScreen(
      <>
        <Badge />
        <ChatInbox />
      </>,
      "SALES_STAFF",
    );
    return api;
  }

  it("listens to the inbox and the user's own queue from the badge, wherever the user is", async () => {
    renderInbox();
    await screen.findByText("Báo giá ly logo xanh");
    expect(subscribed("/topic/chat.inbox")).toBe(true);
    expect(subscribed("/user/queue/chat")).toBe(true);
  });

  it("a queue event replaces the row by id at once (keeping my unread count) and reloads the inbox", async () => {
    const api = renderInbox();
    await screen.findByText("Báo giá ly logo xanh");
    const reads = getsOf(api, "/chat/conversations");
    emit("/topic/chat.inbox", {
      type: "conversation.updated",
      conversationId: CONVERSATION_ID,
      data: { ...myConversation, subject: "Báo giá ly logo xanh (đổi)", unread: 0 },
    });
    const row = await screen.findByRole("link", { name: /Báo giá ly logo xanh \(đổi\)/ });
    expect(within(row).getByText("2")).toBeInTheDocument(); // my unread count, not the row's 0
    await waitFor(() => expect(getsOf(api, "/chat/conversations")).toBe(reads + 1));
  });

  it("an @mention on my queue reloads the badge and tells me", async () => {
    const info = vi.spyOn(toast, "info").mockImplementation(() => undefined);
    const api = renderInbox();
    await screen.findByText("Báo giá ly logo xanh");
    const badgeReads = getsOf(api, "/chat/unread-count");
    emit("/user/queue/chat", {
      type: "message.created",
      conversationId: CONVERSATION_ID,
      data: { ...internalNote, senderName: "Lan", body: "@Test xem giúp" },
    });
    expect(info).toHaveBeenCalledWith("Lan nhắc bạn trong ghi chú nội bộ", "@Test xem giúp");
    await waitFor(() => expect(getsOf(api, "/chat/unread-count")).toBe(badgeReads + 1));
  });
});
