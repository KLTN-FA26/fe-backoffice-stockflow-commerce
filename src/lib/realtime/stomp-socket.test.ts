import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStompSocket, STOMP_KEEPALIVE_MS } from "./stomp-socket";

const stomp = vi.hoisted(() => ({
  configs: [] as Record<string, unknown>[],
  activate: vi.fn(),
  deactivate: vi.fn(async () => undefined),
  publish: vi.fn(),
  subscribe: vi.fn((_destination: string, callback: (message: { body: string }) => void) => {
    callback({ body: '{"type":"typing"}' });
    return { id: "sub-0", unsubscribe: vi.fn() };
  }),
}));

vi.mock("@stomp/stompjs", () => ({
  TickerStrategy: { Interval: "interval", Worker: "worker" },
  Client: class {
    constructor(config: Record<string, unknown>) {
      stomp.configs.push(config);
    }
    activate = stomp.activate;
    deactivate = stomp.deactivate;
    publish = stomp.publish;
    subscribe = stomp.subscribe;
  },
}));

const handlers = { onConnect: vi.fn(), onStompError: vi.fn(), onWebSocketClose: vi.fn() };

describe("createStompSocket: the real stompjs client configuration", () => {
  beforeEach(() => {
    stomp.configs.length = 0;
  });

  it("puts the ticket in the CONNECT header, never on the URL, and leaves reconnects to us", () => {
    createStompSocket("wss://api.test/ws", "secret-ticket", handlers);
    const config = stomp.configs[0];
    expect(config).toMatchObject({
      brokerURL: "wss://api.test/ws",
      connectHeaders: { ticket: "secret-ticket" },
      heartbeatIncoming: STOMP_KEEPALIVE_MS,
      heartbeatOutgoing: STOMP_KEEPALIVE_MS,
      heartbeatStrategy: "worker",
      // stompjs' own reconnect would reuse the spent ticket and bypass our backoff.
      reconnectDelay: 0,
      discardWebsocketOnCommFailure: true,
    });
    expect(STOMP_KEEPALIVE_MS).toBe(10_000);
    expect(String(config?.brokerURL)).not.toContain("secret-ticket");
  });

  it("forwards the client's callbacks and drives activate / publish / deactivate", async () => {
    const socket = createStompSocket("wss://api.test/ws", "t", handlers);
    const config = stomp.configs[0] as {
      onConnect: () => void;
      onStompError: (frame: unknown) => void;
      onWebSocketClose: () => void;
    };
    config.onConnect();
    config.onStompError({ headers: { message: "x" }, body: "" });
    config.onWebSocketClose();
    expect(handlers.onConnect).toHaveBeenCalled();
    expect(handlers.onStompError).toHaveBeenCalledWith({ headers: { message: "x" }, body: "" });
    expect(handlers.onWebSocketClose).toHaveBeenCalled();
    socket.activate();
    socket.publish({ destination: "/app/chat.presence.heartbeat" });
    await socket.deactivate();
    expect(stomp.activate).toHaveBeenCalled();
    expect(stomp.publish).toHaveBeenCalledWith({ destination: "/app/chat.presence.heartbeat" });
    expect(stomp.deactivate).toHaveBeenCalled();
  });

  it("subscribes through the client and hands over the frame body", () => {
    const socket = createStompSocket("wss://api.test/ws", "t", handlers);
    const onMessage = vi.fn();
    const subscription = socket.subscribe("/topic/chat.inbox", onMessage);
    expect(stomp.subscribe).toHaveBeenCalledWith("/topic/chat.inbox", expect.any(Function));
    expect(onMessage).toHaveBeenCalledWith('{"type":"typing"}');
    expect(typeof subscription.unsubscribe).toBe("function");
  });
});
