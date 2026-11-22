import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  ChatConnection,
  PRESENCE_HEARTBEAT_DESTINATION,
  PRESENCE_HEARTBEAT_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  WS_TICKET_INVALID,
} from "./chat-connection";

import type { Mock } from "vitest";
import type { StompSocket, StompSocketHandlers } from "./stomp-socket";

interface FakeSocket extends StompSocket {
  ticket: string;
  handlers: StompSocketHandlers;
  publish: Mock<StompSocket["publish"]>;
  deactivate: Mock<StompSocket["deactivate"]>;
  subscribe: Mock<StompSocket["subscribe"]>;
  /** destination -> the frame callback of its live subscription. */
  followed: Map<string, (body: string) => void>;
  unsubscribed: string[];
}

function setup(url = "wss://api.test/ws") {
  const sockets: FakeSocket[] = [];
  let n = 0;
  const ticketFetcher = vi.fn(async () => `ticket-${++n}`);
  const socketFactory = vi.fn((_url: string, ticket: string, handlers: StompSocketHandlers) => {
    const followed = new Map<string, (body: string) => void>();
    const unsubscribed: string[] = [];
    const socket: FakeSocket = {
      ticket,
      handlers,
      followed,
      unsubscribed,
      activate: vi.fn<StompSocket["activate"]>(),
      deactivate: vi.fn<StompSocket["deactivate"]>(async () => undefined),
      publish: vi.fn<StompSocket["publish"]>(),
      subscribe: vi.fn<StompSocket["subscribe"]>((destination, onMessage) => {
        followed.set(destination, onMessage);
        return {
          unsubscribe: () => {
            followed.delete(destination);
            unsubscribed.push(destination);
          },
        };
      }),
    };
    sockets.push(socket);
    return socket;
  });
  const connection = new ChatConnection({ url, socketFactory, ticketFetcher });
  return { connection, sockets, ticketFetcher, socketFactory };
}

const invalidFrame = { headers: { message: WS_TICKET_INVALID }, body: "" };
const transientFrame = { headers: { message: "Authentication is not available" }, body: "" };

describe("ChatConnection: presence and reconnects", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("connects with a fresh ticket per connect, including reconnects", async () => {
    const { connection, sockets, socketFactory } = setup();
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(sockets[0]?.ticket).toBe("ticket-1");
    expect(socketFactory).toHaveBeenCalledWith("wss://api.test/ws", "ticket-1", expect.anything());

    sockets[0]?.handlers.onConnect();
    sockets[0]?.handlers.onWebSocketClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    expect(sockets[1]?.ticket).toBe("ticket-2");
    connection.stop();
  });

  it("does nothing without a url", async () => {
    const { connection, ticketFetcher, socketFactory } = setup("");
    connection.start();
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_MS);
    expect(ticketFetcher).not.toHaveBeenCalled();
    expect(socketFactory).not.toHaveBeenCalled();
  });

  it("refetches once and retries after WS_TICKET_INVALID, then stops on a second refusal", async () => {
    const { connection, sockets, ticketFetcher } = setup();
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.handlers.onStompError(invalidFrame);
    await vi.advanceTimersByTimeAsync(0);
    expect(ticketFetcher).toHaveBeenCalledTimes(2);
    expect(sockets[1]?.ticket).toBe("ticket-2");

    sockets[1]?.handlers.onStompError(invalidFrame);
    sockets[1]?.handlers.onWebSocketClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_MS * 2);
    expect(ticketFetcher).toHaveBeenCalledTimes(2);
    expect(sockets).toHaveLength(2);
  });

  it("allows another invalid-ticket retry after a successful connect", async () => {
    const { connection, sockets, ticketFetcher } = setup();
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.handlers.onStompError(invalidFrame);
    await vi.advanceTimersByTimeAsync(0);
    sockets[1]?.handlers.onConnect();
    sockets[1]?.handlers.onStompError(invalidFrame);
    await vi.advanceTimersByTimeAsync(0);
    expect(ticketFetcher).toHaveBeenCalledTimes(3);
    connection.stop();
  });

  it("backs off exponentially on transient errors instead of hammering the ticket endpoint", async () => {
    const { connection, sockets, ticketFetcher } = setup();
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.handlers.onStompError(transientFrame);
    sockets[0]?.handlers.onWebSocketClose(); // the close that follows an ERROR frame is the same failure
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS - 1);
    expect(ticketFetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(ticketFetcher).toHaveBeenCalledTimes(2);

    sockets[1]?.handlers.onStompError(transientFrame);
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS * 2 - 1);
    expect(ticketFetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(ticketFetcher).toHaveBeenCalledTimes(3);
    connection.stop();
  });

  it("retries with backoff when the ticket request fails, and stops when it is refused (403)", async () => {
    const { connection, ticketFetcher, socketFactory } = setup();
    ticketFetcher.mockRejectedValueOnce(new ApiError(503, "X", "down"));
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(socketFactory).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    expect(socketFactory).toHaveBeenCalledTimes(1);
    connection.stop();

    const second = setup();
    second.ticketFetcher.mockRejectedValue(new ApiError(403, "FORBIDDEN", "no"));
    second.connection.start();
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_MS * 2);
    expect(second.ticketFetcher).toHaveBeenCalledTimes(1);
  });

  it("publishes a presence heartbeat every 30 s while connected, and stops with the connection", async () => {
    const { connection, sockets } = setup();
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    const socket = sockets[0];
    socket?.handlers.onConnect();
    await vi.advanceTimersByTimeAsync(PRESENCE_HEARTBEAT_MS - 1);
    expect(socket?.publish).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(socket?.publish).toHaveBeenCalledWith({ destination: PRESENCE_HEARTBEAT_DESTINATION });
    await vi.advanceTimersByTimeAsync(PRESENCE_HEARTBEAT_MS);
    expect(socket?.publish).toHaveBeenCalledTimes(2);

    connection.stop();
    expect(socket?.deactivate).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(PRESENCE_HEARTBEAT_MS * 3);
    expect(socket?.publish).toHaveBeenCalledTimes(2);
  });
  it("keeps backing off when a socket connects then drops at once", async () => {
    const { connection, sockets, ticketFetcher } = setup();
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    for (const [i, delay] of [
      RECONNECT_BASE_MS,
      RECONNECT_BASE_MS * 2,
      RECONNECT_BASE_MS * 4,
    ].entries()) {
      sockets[i]?.handlers.onConnect();
      sockets[i]?.handlers.onWebSocketClose();
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(ticketFetcher).toHaveBeenCalledTimes(i + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(ticketFetcher).toHaveBeenCalledTimes(i + 2);
    }
    connection.stop();
  });

  it("resets the backoff once the socket has stayed up for a heartbeat", async () => {
    const { connection, sockets, ticketFetcher } = setup();
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.handlers.onWebSocketClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    sockets[1]?.handlers.onConnect();
    await vi.advanceTimersByTimeAsync(PRESENCE_HEARTBEAT_MS);
    sockets[1]?.handlers.onWebSocketClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    expect(ticketFetcher).toHaveBeenCalledTimes(3);
    connection.stop();
  });

  it("treats a heartbeat that cannot be published as a drop", async () => {
    const { connection, sockets, ticketFetcher } = setup();
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.publish.mockImplementation(() => {
      throw new TypeError("There is no underlying STOMP connection");
    });
    sockets[0]?.handlers.onConnect();
    await vi.advanceTimersByTimeAsync(PRESENCE_HEARTBEAT_MS);
    expect(sockets[0]?.deactivate).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    expect(ticketFetcher).toHaveBeenCalledTimes(2);
    connection.stop();
  });

  it("opens no socket when stopped while the ticket is being fetched", async () => {
    const { connection, ticketFetcher, socketFactory } = setup();
    let release: (ticket: string) => void = () => undefined;
    ticketFetcher.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    connection.start();
    connection.stop();
    release("late-ticket");
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_MS);
    expect(socketFactory).not.toHaveBeenCalled();
  });

  it("does not reconnect when stopped during a pending retry", async () => {
    const { connection, sockets, ticketFetcher } = setup();
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.handlers.onWebSocketClose();
    connection.stop();
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_MS * 2);
    expect(ticketFetcher).toHaveBeenCalledTimes(1);
  });
});

describe("ChatConnection: subscriptions on the one socket", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const event = (type: string) => JSON.stringify({ type, conversationId: "c1", data: {} });

  it("subscribes registered destinations once connected, and delivers parsed events to every listener", async () => {
    const { connection, sockets } = setup();
    const first = vi.fn();
    const second = vi.fn();
    connection.subscribe("/topic/chat.inbox", first);
    connection.subscribe("/topic/chat.inbox", second);
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(sockets[0]?.subscribe).not.toHaveBeenCalled(); // not before CONNECTED
    sockets[0]?.handlers.onConnect();
    expect(sockets[0]?.subscribe).toHaveBeenCalledTimes(1); // one STOMP subscription for both listeners
    sockets[0]?.followed.get("/topic/chat.inbox")?.(event("conversation.updated"));
    expect(first).toHaveBeenCalledWith(expect.objectContaining({ type: "conversation.updated" }));
    expect(second).toHaveBeenCalledTimes(1);
    sockets[0]?.followed.get("/topic/chat.inbox")?.("not json");
    expect(first).toHaveBeenCalledTimes(1);
    connection.stop();
  });

  it("subscribes at once when already connected, and unsubscribes when the last listener leaves", async () => {
    const { connection, sockets } = setup();
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.handlers.onConnect();
    const offA = connection.subscribe("/topic/chat.conversations.c1", vi.fn());
    const offB = connection.subscribe("/topic/chat.conversations.c1", vi.fn());
    expect(sockets[0]?.subscribe).toHaveBeenCalledTimes(1);
    offA();
    expect(sockets[0]?.unsubscribed).toEqual([]);
    offB();
    expect(sockets[0]?.unsubscribed).toEqual(["/topic/chat.conversations.c1"]);
    connection.stop();
  });

  it("resubscribes every destination on the next socket after a drop", async () => {
    const { connection, sockets } = setup();
    const listener = vi.fn();
    connection.subscribe("/user/queue/chat", listener);
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.handlers.onConnect();
    sockets[0]?.handlers.onWebSocketClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    sockets[1]?.handlers.onConnect();
    expect(sockets[1]?.subscribe).toHaveBeenCalledWith("/user/queue/chat", expect.any(Function));
    sockets[1]?.followed.get("/user/queue/chat")?.(event("message.created"));
    expect(listener).toHaveBeenCalledTimes(1);
    connection.stop();
  });

  it("reports its status: up on CONNECTED, down on a drop and on stop", async () => {
    const { connection, sockets } = setup();
    const status = vi.fn();
    connection.onStatus(status);
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(connection.isConnected()).toBe(false);
    sockets[0]?.handlers.onConnect();
    expect(connection.isConnected()).toBe(true);
    sockets[0]?.handlers.onWebSocketClose();
    expect(connection.isConnected()).toBe(false);
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    sockets[1]?.handlers.onConnect();
    connection.stop();
    expect(status.mock.calls.map(([up]) => up)).toEqual([true, false, true, false]);
  });

  it("drops a destination the BE refused, so the reconnect is not refused again", async () => {
    const { connection, sockets } = setup();
    connection.subscribe("/topic/chat.conversations.gone", vi.fn());
    connection.subscribe("/topic/chat.inbox", vi.fn());
    connection.start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.handlers.onConnect();
    sockets[0]?.handlers.onStompError({
      headers: { message: "Not allowed to subscribe to /topic/chat.conversations.gone" },
      body: "",
    });
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    sockets[1]?.handlers.onConnect();
    expect(sockets[1]?.subscribe.mock.calls.map(([destination]) => destination)).toEqual([
      "/topic/chat.inbox",
    ]);
    connection.stop();
  });
});
