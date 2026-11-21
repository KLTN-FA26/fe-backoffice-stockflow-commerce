import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  PRESENCE_HEARTBEAT_DESTINATION,
  PRESENCE_HEARTBEAT_MS,
  PresenceConnection,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  WS_TICKET_INVALID,
} from "./presence-connection";

import type { Mock } from "vitest";
import type { PresenceSocket, PresenceSocketHandlers } from "./presence-connection";

interface FakeSocket extends PresenceSocket {
  ticket: string;
  handlers: PresenceSocketHandlers;
  publish: Mock<PresenceSocket["publish"]>;
  deactivate: Mock<PresenceSocket["deactivate"]>;
}

function setup(url = "wss://api.test/ws") {
  const sockets: FakeSocket[] = [];
  let n = 0;
  const ticketFetcher = vi.fn(async () => `ticket-${++n}`);
  const socketFactory = vi.fn((_url: string, ticket: string, handlers: PresenceSocketHandlers) => {
    const socket: FakeSocket = {
      ticket,
      handlers,
      activate: vi.fn<PresenceSocket["activate"]>(),
      deactivate: vi.fn<PresenceSocket["deactivate"]>(async () => undefined),
      publish: vi.fn<PresenceSocket["publish"]>(),
    };
    sockets.push(socket);
    return socket;
  });
  const connection = new PresenceConnection({ url, socketFactory, ticketFetcher });
  return { connection, sockets, ticketFetcher, socketFactory };
}

const invalidFrame = { headers: { message: WS_TICKET_INVALID }, body: "" };
const transientFrame = { headers: { message: "Authentication is not available" }, body: "" };

describe("PresenceConnection", () => {
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
});
