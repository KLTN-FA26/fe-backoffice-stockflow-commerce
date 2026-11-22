/**
 * The stompjs client behind the back office's one chat socket (BE `/ws`), wrapped in the few calls `ChatConnection`
 * drives, so tests can hand it a stand-in.
 */

import { Client, TickerStrategy } from "@stomp/stompjs";

import type { IFrame } from "@stomp/stompjs";

export const STOMP_KEEPALIVE_MS = 10_000;

/** One live STOMP subscription. */
export interface SocketSubscription {
  unsubscribe(): void;
}

/** The part of the stompjs `Client` the connection drives. */
export interface StompSocket {
  activate(): void;
  deactivate(): Promise<void>;
  publish(params: { destination: string }): void;
  /** Only while connected; `onMessage` receives the raw frame body (JSON text). */
  subscribe(destination: string, onMessage: (body: string) => void): SocketSubscription;
}

export interface StompSocketHandlers {
  onConnect(): void;
  onStompError(frame: Pick<IFrame, "headers" | "body">): void;
  onWebSocketClose(): void;
}

export type StompSocketFactory = (
  url: string,
  ticket: string,
  handlers: StompSocketHandlers,
) => StompSocket;

export const createStompSocket: StompSocketFactory = (url, ticket, handlers) => {
  const client = new Client({
    brokerURL: url,
    connectHeaders: { ticket },
    heartbeatIncoming: STOMP_KEEPALIVE_MS,
    heartbeatOutgoing: STOMP_KEEPALIVE_MS,
    // Outgoing pings from a Web Worker: a hidden tab's throttled timers must not let Spring drop the session (stompjs
    // falls back to setInterval where there is no Worker).
    heartbeatStrategy: TickerStrategy.Worker,
    reconnectDelay: 0, // reconnects are ours: a new ticket for each, with backoff
    // A lost STOMP heartbeat drops the socket at once instead of waiting for a close handshake on a dead network.
    discardWebsocketOnCommFailure: true,
    onConnect: () => handlers.onConnect(),
    onStompError: (frame) => handlers.onStompError(frame),
    onWebSocketClose: () => handlers.onWebSocketClose(),
  });
  return {
    activate: () => client.activate(),
    deactivate: () => client.deactivate(),
    publish: (params) => client.publish(params),
    subscribe: (destination, onMessage) =>
      client.subscribe(destination, (message) => onMessage(message.body)),
  };
};
