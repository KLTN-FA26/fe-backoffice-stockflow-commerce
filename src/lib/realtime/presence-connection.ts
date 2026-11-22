/**
 * Staff chat presence over STOMP `/ws` (BE `ChatStompController`): the socket being connected makes the agent
 * online; a heartbeat every 30 s keeps them so. Presence only - no subscriptions, messages stay on REST.
 *
 * Every CONNECT (first and each reconnect) carries a fresh ticket. `WS_TICKET_INVALID` earns one new ticket and one
 * retry, then we stop quietly. Any other failure (`Authentication is not available`, network, ticket endpoint
 * errors) is transient: reconnect with exponential backoff so the ticket endpoint (30/min) is never hammered.
 */

import { Client, TickerStrategy } from "@stomp/stompjs";

import { ApiError } from "@/lib/api/error";

import { fetchSocketTicket } from "./socket-ticket";

import type { IFrame } from "@stomp/stompjs";

export const PRESENCE_HEARTBEAT_DESTINATION = "/app/chat.presence.heartbeat";
export const PRESENCE_HEARTBEAT_MS = 30_000;
export const STOMP_KEEPALIVE_MS = 10_000;
export const WS_TICKET_INVALID = "WS_TICKET_INVALID";
export const RECONNECT_BASE_MS = 2_000;
export const RECONNECT_MAX_MS = 60_000;

/** The part of the stompjs `Client` this module drives (so tests can supply a stand-in). */
export interface PresenceSocket {
  activate(): void;
  deactivate(): Promise<void>;
  publish(params: { destination: string }): void;
}

export interface PresenceSocketHandlers {
  onConnect(): void;
  onStompError(frame: Pick<IFrame, "headers" | "body">): void;
  onWebSocketClose(): void;
}

export type PresenceSocketFactory = (
  url: string,
  ticket: string,
  handlers: PresenceSocketHandlers,
) => PresenceSocket;

export const createStompSocket: PresenceSocketFactory = (url, ticket, handlers) => {
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
  };
};

interface Options {
  url: string;
  socketFactory?: PresenceSocketFactory;
  ticketFetcher?: (signal?: AbortSignal) => Promise<string>;
}

/** Ticket endpoint answers that mean "stop": not signed in / not allowed. Everything else is retried. */
function isFinalTicketFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export class PresenceConnection {
  private readonly url: string;
  private readonly socketFactory: PresenceSocketFactory;
  private readonly ticketFetcher: (signal?: AbortSignal) => Promise<string>;

  private stopped = true;
  private socket: PresenceSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  private invalidStreak = 0;
  private transientFailures = 0;

  constructor(options: Options) {
    this.url = options.url;
    this.socketFactory = options.socketFactory ?? createStompSocket;
    this.ticketFetcher = options.ticketFetcher ?? fetchSocketTicket;
  }

  start(): void {
    if (!this.stopped || !this.url) return;
    this.stopped = false;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.generation += 1;
    this.abort?.abort();
    this.abort = null;
    this.clearTimers();
    this.closeSocket();
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const generation = ++this.generation;
    this.abort = new AbortController();
    let ticket: string;
    try {
      ticket = await this.ticketFetcher(this.abort.signal);
    } catch (error) {
      if (generation !== this.generation) return;
      if (isFinalTicketFailure(error)) this.stop();
      else this.retryLater();
      return;
    }
    if (generation !== this.generation) return;

    let failed = false;
    const fail = (kind: "invalid" | "transient") => {
      if (failed || generation !== this.generation) return;
      failed = true;
      this.clearHeartbeat();
      this.closeSocket();
      if (kind === "invalid") {
        this.invalidStreak += 1;
        // One fresh ticket, one retry; a second refusal in a row ends it.
        if (this.invalidStreak > 1) this.stop();
        else void this.connect();
      } else {
        this.retryLater();
      }
    };

    this.socket = this.socketFactory(this.url, ticket, {
      onConnect: () => {
        if (generation !== this.generation) return;
        // The ticket worked. The backoff resets only once the socket has stayed up (first heartbeat below): a socket
        // that connects then drops at once must keep backing off, or it spends the 30/min ticket budget.
        this.invalidStreak = 0;
        this.startHeartbeat(() => fail("transient"));
      },
      onStompError: (frame) =>
        fail(frame.headers.message === WS_TICKET_INVALID ? "invalid" : "transient"),
      onWebSocketClose: () => fail("transient"),
    });
    this.socket.activate();
  }

  private retryLater(): void {
    if (this.stopped) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.transientFailures, RECONNECT_MAX_MS);
    this.transientFailures += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  private startHeartbeat(onBroken: () => void): void {
    this.clearHeartbeat();
    this.heartbeat = setInterval(() => {
      try {
        this.socket?.publish({ destination: PRESENCE_HEARTBEAT_DESTINATION });
      } catch {
        // stompjs throws when the connection is already gone: treat it as the drop it is.
        onBroken();
        return;
      }
      this.transientFailures = 0;
    }, PRESENCE_HEARTBEAT_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private clearTimers(): void {
    this.clearHeartbeat();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (socket) void socket.deactivate().catch(() => undefined);
  }
}
